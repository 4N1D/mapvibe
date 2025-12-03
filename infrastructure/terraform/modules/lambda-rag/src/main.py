import os
import json
import boto3
import uvicorn
import time
import random
import pytz
import logging
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum  # <--- CẦU NỐI LAMBDA

from pydantic import BaseModel
from sqlalchemy import create_engine, text

from botocore.exceptions import ClientError


# --- 1. CẤU HÌNH & LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Lấy cấu hình từ Biến môi trường (CDK truyền vào)
AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")
DB_HOST = os.environ.get("DB_HOST")
DB_NAME = os.environ.get("DB_NAME", "food_recommendation")

# Client AWS
secrets_client = boto3.client('secretsmanager', region_name=AWS_REGION)
bedrock_client = boto3.client(service_name='bedrock-runtime', region_name=AWS_REGION)

# --- HÀM LẤY DB URL TỪ SECRET ---
def get_db_url():
    try:
        if not DB_SECRET_ARN:
            logger.warning("⚠️ Missing DB_SECRET_ARN env var")
            return None
            
        response = secrets_client.get_secret_value(SecretId=DB_SECRET_ARN)
        creds = json.loads(response['SecretString'])
        user = creds.get('username')
        password = creds.get('password')
        
        # Connection string cho pg8000
        url = f"postgresql+pg8000://{user}:{password}@{DB_HOST}:5432/{DB_NAME}"
        return url
    except Exception as e:
        logger.error(f"❌ Error getting DB Secret: {str(e)}")
        return None
    
try:
    db_url = get_db_url()
    if db_url:
        engine = create_engine(db_url, pool_size=1, max_overflow=0)
        logger.info("✅ Database Engine initialized.")
    else:
        logger.error("❌ Could not initialize DB Engine (Missing URL)")
except Exception as e:
    logger.error(f"❌ Engine Creation Failed: {str(e)}")
    # Vẫn để app chạy để trả về lỗi cho user biết


# MODEL CONFIG
MODEL_EMBED = "amazon.titan-embed-text-v2:0"
MODEL_INTENT = "us.anthropic.claude-3-haiku-20240307-v1:0"
MODEL_CHAT   = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"

# --- 2. KHỞI TẠO FASTAPI ---
app = FastAPI(title="VN Food RAG - Serverless")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. QUẢN LÝ STATE ---
# Lưu ý: Trên Lambda, biến này sẽ bị reset khi container tắt. 
# Để lưu lâu dài cần dùng DynamoDB (như bài trước đã bàn). Tạm thời dùng dict để test logic.
USER_SESSIONS: Dict[str, List[Dict]] = {}
VN_TZ = pytz.timezone('Asia/Ho_Chi_Minh')

class SearchPayload(BaseModel):
    query: str
    session_id: str
    is_new_topic: bool = False

# --- 4. RAG SERVICE (CORE LOGIC CỦA BẠN) ---
class RAGService:
    def __init__(self, session_id: str, history: List[Dict]):
        self.session_id = session_id
        self.history = history
        self.bedrock = bedrock_client

    def call_bedrock_retry(self, model_id, messages, system_prompts=None, tool_config=None):
        """
        Cơ chế Retry + LOGGING CHI TIẾT (Cost & Latency)
        """
        max_retries = 5
        start_time = datetime.now() # Bắt đầu đếm giờ
        
        for i in range(max_retries):
            try:
                kwargs = {
                    "modelId": model_id,
                    "messages": messages,
                    "inferenceConfig": {"temperature": 0.3} 
                }
                if system_prompts: kwargs["system"] = system_prompts
                if tool_config: kwargs["toolConfig"] = tool_config
                
                response = self.bedrock.converse(**kwargs)
                
                # --- LOGGING PHẦN BEDROCK ---
                duration = (datetime.now() - start_time).total_seconds()
                usage = response.get('usage', {})
                input_tokens = usage.get('inputTokens', 0)
                output_tokens = usage.get('outputTokens', 0)
                
                logger.info(f"[BEDROCK] Model: {model_id} | Time: {duration:.2f}s | In: {input_tokens} tok | Out: {output_tokens} tok")
                return response
            
            except ClientError as e:
                error_code = e.response['Error']['Code']
                if error_code == 'ThrottlingException':
                    wait_time = (2 ** i) + random.uniform(0, 1)
                    logger.warning(f"⚠️ Throttling. Retry {i+1}/{max_retries} in {wait_time:.2f}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"[BEDROCK ERROR] {e}")
                    raise e
                    
        raise Exception("AWS Bedrock quá tải, vui lòng thử lại sau!")

    def get_embedding(self, text_input: str):
        if not text_input: return None
        body = json.dumps({"inputText": text_input, "dimensions": 1024, "normalize": True})
        try:
            response = self.bedrock.invoke_model(modelId=MODEL_EMBED, body=body)
            return json.loads(response["body"].read())["embedding"]
        except Exception as e:
            logger.error(f"Embedding Error: {e}")
            return None

    def parse_intent(self, user_input: str) -> Dict[str, Any]:
        """
        Dùng CLAUDE HAIKU + Tool Use
        """
        current_time = datetime.now(VN_TZ).strftime("%H:%M")
        
        tool_spec = {
            "tools": [{
                "toolSpec": {
                    "name": "extract_filters",
                    "description": "Trích xuất nhu cầu tìm kiếm.",
                    "inputSchema": {
                        "json": {
                            "type": "object",
                            "properties": {
                                "search_text": {"type": "string"},
                                "district": {"type": "string", "description": "Tên Quận/Huyện đã chuẩn hóa. QUY TẮC: 1. Viết tắt: 'Q1' -> 'Quận 1', 'Q.3' -> 'Quận 3'. 2. Tên chữ: 'Tân Bình', 'Thủ Đức' -> Giữ nguyên. 3. ĐẶC BIỆT: Nếu user nói 'Sài Gòn', 'TPHCM', 'Thành phố' hoặc không nói rõ quận -> Trả về NULL (để tìm toàn thành phố)."},
                                "min_price": {"type": "integer", "description": "Giá thấp nhất (VND). Nếu user nhập '50k', hãy convert thành 50000. Nếu user KHÔNG nói ngân sách cụ thể thì đừng quan tâm đến giá ."},
                                "max_price": {"type": "integer", "description": "Giá cao nhất (VND). Lưu ý: 'k' = 000. VD: '40k' -> 40000. QUAN TRỌNG: Nếu user KHÔNG nói ngân sách cụ thể thì đừng quan tâm đến giá."},
                                "is_open_now": {"type": "boolean"},
                                "search_strategy": {"type": "string", "enum": ["precise", "semantic"]},
                                "exclude_keywords": {"type": "array", "items": {"type": "string"},"description": """
                                Danh sách từ khóa user muốn loại trừ. 
                                QUAN TRỌNG: Hãy tư duy mở rộng (Brainstorm). 
                                Ví dụ: Nếu user cấm 'hải sản', hãy thêm cả: ['hải sản', 'sushi', 'sashimi', 'cua', 'tôm', 'cá', 'ốc'].
                                Nếu user cấm 'ngọt', thêm: ['ngọt', 'chè', 'bánh', 'trà sữa'].
                                """},
                                "exclude_districts": {"type": "array","items": {"type": "string"},"description": "Danh sách quận user KHÔNG MUỐN đến. VD: User nói 'trừ Q1, Q3' -> ['Quận 1', 'Quận 3']."},
                                "target_categories": {"type": "array","items": {"type": "string"},"description": """
                                Danh sách các loại hình quán user ĐANG TÌM.
                                QUAN TRỌNG: 
                                1. Nếu user tìm 'cafe', 'nước', 'trà sữa' -> CHỈ lấy ['Cà phê', 'Trà sữa', 'Giải khát']. TUYỆT ĐỐI KHÔNG thêm 'Quán ăn', 'Nhà hàng'.
                                2. Nếu user tìm 'ăn', 'cơm', 'phở' -> Lấy ['Nhà hàng', 'Quán ăn', 'Món Việt', ...].
                                3. Nếu user tìm 'nhậu' -> Lấy ['Quán nhậu', 'Beer', 'Bar'].
                                4. Nếu user tìm MÓN CỤ THỂ (VD: 'BBQ', 'Lẩu', 'Sushi', 'Pizza', 'Chay') -> CHỈ lấy category đó. TUYỆT ĐỐI KHÔNG thêm 'Nhà hàng' hay 'Quán ăn'.
                                (VD: Tìm 'BBQ' -> ['Nướng', 'Buffet', 'Grill']. KHÔNG lấy 'Nhà hàng').
                                Hãy chọn category sát nhất với từ khóa của user.
                                5. Nếu user tìm ĐẶC ĐIỂM RIÊNG (VD: 'Rooftop', 'View đẹp', 'Sân vườn', 'Cá Koi', 'Mèo') -> CHỈ lấy category chứa đặc điểm đó (VD: ['Rooftop', 'Sân vườn', 'View']). 
                                -> TUYỆT ĐỐI KHÔNG thêm 'Cafe' hay 'Nhà hàng' chung chung vào list này.
                                6. Nếu user tìm 'Bar', 'Pub', 'Club', 'Quẩy' -> 
                                - Lấy ['Bar', 'Pub', 'Club', 'Nightlife', 'Lounge'].
                                - QUAN TRỌNG: TUYỆT ĐỐI KHÔNG lấy 'Nhà hàng', 'Steakhouse', 'Grill', 'Kitchen', 'Bistro'. 
                                (Vì 'Grill & Bar' thường là chỗ ăn, không phải chỗ quẩy).
                                7. LOGIC ĐẶC BIỆT KHI USER TIÊU CỰC (Chửi thề, buồn, chán):
                                - Nếu user đang bực bội/chửi (mood='negative'), hãy TỰ ĐỘNG gợi ý các món 'Giải sầu' phù hợp:
                                    + ['Quán nhậu', 'Bia', 'Bar'] (để xả stress).
                                    + ['Đồ ngọt', 'Trà sữa', 'Bánh'] (để user thấy ngọt ngào hơn).
                                    + ['Lẩu', 'Nướng'] (ăn cho đã cơn thèm).
                                - Đừng trả về danh sách trống khi user chửi bậy. Hãy lấp đầy bằng các món trên.                      
                                """},
                                "mood": {
                                    "type": "string",
                                    "enum": ["neutral", "negative"],
                                    "description": "Nếu user chửi thề, dùng từ ngữ tiêu cực, than vãn, buồn bã -> Đặt là 'negative'. Còn lại là 'neutral'."
                                }               
                            },
                            "required": ["search_text", "search_strategy"]
                        }
                    }
                }
            }]
        }

        messages_payload = self.history[-6:]
        messages_payload.append({"role": "user", "content": [{"text": user_input}]})
        system_prompt = [{"text": f"Giờ là {current_time}. Kế thừa lịch sử tìm kiếm."}]

        try:
            response = self.call_bedrock_retry(
                model_id=MODEL_INTENT, 
                messages=messages_payload,
                system_prompts=system_prompt,
                tool_config=tool_spec
            )
            
            output_content = response['output']['message']['content']
            for block in output_content:
                if 'toolUse' in block:
                    params = block['toolUse']['input']
                    
                    if params.get("district") == "NULL":
                        params["district"] = None
                    return params
            
            return {"search_text": user_input, "search_strategy": "semantic"}
        except Exception:
            return {"search_text": user_input, "search_strategy": "semantic"}

    def execute_db_search(self, params: Dict[str, Any], min_score: float = 0.0):
        start_time = datetime.now() # Bắt đầu đếm giờ SQL
        
        if not engine:
            raise Exception("Database Engine is NOT connected. Check AWS Secrets or Network.")

        query_text = params.get("search_text", "")
        strategy = params.get("search_strategy", "semantic")
        
        query_emb = self.get_embedding(query_text)
        if not query_emb: return []
        emb_literal = "[" + ",".join(map(str, query_emb)) + "]"

        if strategy == "precise":
            w_text, w_vec = 0.7, 0.3
        else:
            w_text, w_vec = 0.3, 0.7

        clean_query = " | ".join(query_text.replace("!", "").replace("&", "").split())

        sql_base = f"""
        SELECT id, name_vi, address, price_min, price_max, "opening_hours", business_type,
            (
                {w_text} * (
                ts_rank_cd(search_vector, to_tsquery('simple', unaccent(:query_ts))) / 
                (ts_rank_cd(search_vector, to_tsquery('simple', unaccent(:query_ts))) + 1)
            ) 
            + 
            {w_vec} * (1 - (embedding <=> :emb_literal))
            ) as final_score
        FROM restaurants
        WHERE 1=1
        """
        
        sql_params = {"query_ts": clean_query, "emb_literal": emb_literal}

        if params.get("district"):
            sql_base += " AND address ILIKE :district"
            sql_params["district"] = f"%{params['district']}%"

        if params.get("max_price"):
            sql_base += " AND price_min <= :max_p"
            sql_params["max_p"] = params["max_price"]
            
        if params.get("min_price"):
            sql_base += " AND price_max >= :min_p"
            sql_params["min_p"] = params["min_price"]

        if params.get("is_open_now"):
            now = datetime.now(VN_TZ)
            sql_params["now"] = now.strftime("%H:%M:00")
            sql_base += """
                AND (
                    "opening_hours" ILIKE '%Cả ngày%' 
                    OR (
                        "opening_hours" ~ '^\d{2}:\d{2} - \d{2}:\d{2}$'
                        AND (
                            CASE 
                                WHEN CAST(split_part("opening_hours", ' - ', 1) AS TIME) <= CAST(split_part("opening_hours", ' - ', 2) AS TIME) THEN
                                    CAST(:now AS TIME) BETWEEN CAST(split_part("opening_hours", ' - ', 1) AS TIME) AND CAST(split_part("opening_hours", ' - ', 2) AS TIME)
                                ELSE 
                                    CAST(:now AS TIME) >= CAST(split_part("opening_hours", ' - ', 1) AS TIME) 
                                    OR CAST(:now AS TIME) <= CAST(split_part("opening_hours", ' - ', 2) AS TIME)
                            END
                        )
                    )
                )
            """

        if strategy == "precise":
             sql_base += " AND search_vector @@ to_tsquery('simple', unaccent(:query_ts))"

        if params.get("exclude_keywords"):
            for i, keyword in enumerate(params["exclude_keywords"]):
                # Tạo param name động: exclude_0, exclude_1...
                arg_name = f"exclude_{i}"
                # Logic: Tên quán HOẶC Category không được chứa từ khóa này
                sql_base += f""" 
                    AND NOT (
                        name ILIKE :{arg_name} 
                        OR category ILIKE :{arg_name}
                        OR description ILIKE :{arg_name}
                    )
                """
                sql_params[arg_name] = f"%{keyword}%"

        if params.get("exclude_districts"):
            for i, dist in enumerate(params["exclude_districts"]):
                # Chuẩn hóa tên quận nếu cần (để đảm bảo khớp DB)
                # Ở đây giả sử Bot đã trả về "Quận 1", "Quận 3" chuẩn
                arg_name = f"ex_dist_{i}"
                
                # Logic: Địa chỉ KHÔNG ĐƯỢC chứa tên quận này
                sql_base += f" AND address NOT ILIKE :{arg_name}"
                sql_params[arg_name] = f"%{dist}%"
                
        or_conditions = []
        if params.get("target_categories"):
        # Tạo danh sách điều kiện OR (VD: category LIKE cafe OR category LIKE trà sữa)
            or_conditions = []
            for i, cat in enumerate(params["target_categories"]):
                arg_name = f"inc_cat_{i}"
                or_conditions.append(f"(category ILIKE :{arg_name} OR name ILIKE :{arg_name})")
                sql_params[arg_name] = f"%{cat}%"
        
        # Gộp lại bằng OR và đóng ngoặc
        if or_conditions:
            sql_base += f" AND ({' OR '.join(or_conditions)})"        

        sql_base += " ORDER BY final_score DESC LIMIT 8;"

        with engine.connect() as conn:
            rows = conn.execute(text(sql_base), sql_params).fetchall()
            results = [row for row in rows if row.final_score >= min_score]
            
            # --- LOGGING PHẦN SQL ---
            duration = (datetime.now() - start_time).total_seconds()
            top_score = results[0].final_score if results else 0
            logger.info(f"[SQL] Found: {len(results)} items | Time: {duration:.2f}s | Top Score: {top_score:.4f} | Filters: {params}")
            
            return results

    def search_pipeline(self, params):
        # logger.info(f"🚀 Searching with Params: {params}") # Đã log trong Endpoint rồi nên có thể ẩn bớt
        
        # 1. Strict
        results = self.execute_db_search(params, min_score=0.2)
        if results: return results, "Đây là kết quả phù hợp nhất:"

        # 2. Relax Time/Price
        relax_params = params.copy()
        has_strict = any(k in params for k in ["min_price", "max_price", "is_open_now"])
        if has_strict:
            relax_params.pop("min_price", None)
            relax_params.pop("max_price", None)
            relax_params.pop("is_open_now", None)
            logger.info(f"⚠️ Trigger Fallback 1 (Drop Price/Time)")
            results = self.execute_db_search(relax_params, min_score=0.2)
            if results: return results, "Không đúng giá/giờ yêu cầu, nhưng có quán này:"

        # 3. Relax District
        if "district" in params:
            d_params = params.copy()
            del d_params["district"]
            d_params.pop("is_open_now", None)
            logger.info(f"⚠️ Trigger Fallback 2 (Drop District)")
            results = self.execute_db_search(d_params, min_score=0.2)
            if results: return results, f"Quận {params['district']} không có, nhưng chỗ khác có:"

        # 4. Semantic
        logger.info(f"⚠️ Trigger Fallback 3 (Semantic Only)")
        results = self.execute_db_search({"search_text": params["search_text"], "search_strategy": "semantic"}, min_score=0.25)
        if results: return results, "Tìm theo vibe/ngữ nghĩa:"
        
        return [], ""

    def generate_response_and_data(self, user_input, results, system_note, user_mood="neutral"):
        if not results:
            if user_mood == "negative":
                return "Nghe vẻ bạn đang có chuyện không vui, nhưng tiếc là mình chưa tìm được quán nào phù hợp để giải sầu lúc này. Thử lại khu vực khác xem sao nhé! 🍺", []
            return "Xin lỗi, không tìm thấy quán nào phù hợp. 😅", []

        restaurants_data = []
        context_str = ""
        for row in results:
            p_min = int(row.price_min) if row.price_min else 0
            p_max = int(row.price_max) if row.price_max else 0
            price_display = f"{p_min:,} - {p_max:,} VNĐ" if (p_min or p_max) else "Đang cập nhật"
            item = {
                "id": row.id, 
                "name": row.name, 
                "address": row.address or "N/A",
                "priceRange": price_display, 
                "hours": row.opening_hours or "N/A",
                "category": row.category, 
                "score": f"{row.final_score:.2f}"
            }
            restaurants_data.append(item)
            context_str += f"- {item['name']} ({item['address']}) | Giá: {item['priceRange']} | Giờ: {item['hours']} | Loại: {item['category']}\n"


        tone_instruction = "Trả lời ngắn gọn, thân thiện, lịch sự."
        if user_mood == "negative":
            tone_instruction = """
            USER ĐANG CÓ TÂM TRẠNG XẤU (Bực bội, buồn, hoặc vừa chửi thề).
            NHIỆM VỤ CỦA BẠN:
            1. Không giáo điều, không chỉnh đốn ngôn từ của khách.
            2. Hãy tỏ ra đồng cảm, 'chill' và tâm lý (kiểu như một người bạn thân rủ đi nhậu giải sầu).
            3. Dùng các câu dẫn như: 'Hạ hỏa nào bạn ơi', 'Đời đắng thì mình tìm gì ngọt ngào ăn nhé', 'Làm ly bia cho quên sự đời'.
            4. Giới thiệu các quán bên dưới như là liều thuốc tinh thần.
            """
        prompt = f"""
        QUERY: "{user_input}"
        NOTE: "{system_note}"
        TONE: {tone_instruction}
        DATA:
        {context_str}
        
        Trả lời user dựa trên DATA. Nhắc khéo nếu NOTE có cảnh báo. Ngắn gọn, thân thiện.
        """
        messages = self.history[-6:] + [{"role": "user", "content": [{"text": prompt}]}]

        try:
            resp = self.call_bedrock_retry(MODEL_CHAT, messages)
            return resp['output']['message']['content'][0]['text'], restaurants_data
        except Exception:
            return "Dưới đây là danh sách quán.", restaurants_data

# --- 5. API ENDPOINT ---
@app.get("/")
def health_check():
    return {"status": "ok", "service": "VN Food RAG"}

@app.post("/api/search")
async def search_endpoint(payload: SearchPayload):
    # --- LOG START REQUEST ---
    try:
        logger.info(f"\n{'='*20} NEW REQUEST [Session: {payload.session_id}] {'='*20}")
        logger.info(f"[USER QUERY] {payload.query}")

        
        session_mgr = USER_SESSIONS.get(payload.session_id, [])
        if payload.is_new_topic: session_mgr = []
        
        rag = RAGService(payload.session_id, session_mgr)

        # Pipeline
        params = rag.parse_intent(payload.query)
        logger.info(f"[INTENT] {params}") # Log Intent đã parse được

        # Lấy mood ra (mặc định là neutral nếu không có)
        current_mood = params.get("mood", "neutral")

        results, note = rag.search_pipeline(params)
        answer, json_data = rag.generate_response_and_data(payload.query, results, note, user_mood=current_mood)

        # Save History
        session_mgr.append({"role": "user", "content": [{"text": payload.query}]})
        session_mgr.append({"role": "assistant", "content": [{"text": answer}]})
        USER_SESSIONS[payload.session_id] = session_mgr

        # --- LOG END REQUEST ---
        logger.info(f"--- END REQUEST ---\n") 

        return {
            "answer": answer,
            "restaurants": json_data,
            "debug_intent": params
        }
    except Exception as e:
        # --- TRẢ VỀ LỖI CHI TIẾT RA POSTMAN ---
        logger.error(f"CRITICAL ERROR: {str(e)}")
        logger.error(traceback.format_exc()) # Log traceback đầy đủ lên CloudWatch

        return {
            "status": "error",
            "message": str(e),
            "type": type(e).__name__,
            "hint": "Check CloudWatch logs for full traceback."
        }

# --- 6. HANDLER CHO LAMBDA ---
handler = Mangum(app)