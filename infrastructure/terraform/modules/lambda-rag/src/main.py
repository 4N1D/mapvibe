import os
import json
import boto3
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

import hashlib
from collections import OrderedDict

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

# Cache embeddings trong Lambda container - dùng OrderedDict để tự động evict item cũ nhất
MAX_CACHE_SIZE = 100
EMBEDDING_CACHE = OrderedDict()

def get_cache_key(text: str) -> str:
    """Tạo cache key từ text input"""
    return hashlib.md5(text.encode('utf-8')).hexdigest()

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
        # pg8000 doesn't support connect_timeout parameter
        # Timeout is handled by SQLAlchemy pool settings instead
        engine = create_engine(
            db_url,
            pool_size=2,
            max_overflow=1,
            pool_pre_ping=True,
            pool_recycle=3600,
            connect_args={}
        )
        logger.info("✅ Database Engine initialized with optimized pool settings.")
    else:
        logger.error("❌ Could not initialize DB Engine (Missing URL)")
except Exception as e:
    logger.error(f"❌ Engine Creation Failed: {str(e)}")
    # Vẫn để app chạy để trả về lỗi cho user biết


# --- MAPPING QUẬN CŨ -> PHƯỜNG MỚI (Theo Nghị quyết 1685/NQ-UBTVQH15, tháng 7/2025) ---
# Nguồn: https://tphcm.chinhphu.vn/danh-sach-chinh-thuc-168-phuong-xa-cua-tphcm-sau-sap-xep-101250617000144317.htm
DISTRICT_TO_WARDS = {
    "Quận 1": [
        "Phường Tân Định",
        "Phường Bến Thành",
        "Phường Sài Gòn",
        "Phường Cầu Ông Lãnh"
    ],
     "Quận 3": [
        "Phường Bàn Cờ",  # Từ P.1 + P.2 + P.3 + P.5 + một phần P.4
        "Phường Xuân Hòa",  # Từ P. Võ Thị Sáu + phần còn lại P.4
        "Phường Nhiêu Lộc"  # Từ P.9 + P.10 + P.11 + P.12 + P.13 + P.14
    ],
    "Quận 4": [
        "Phường Vĩnh Hội",  # Từ P.1 + P.3 + một phần P.2 + một phần P.4
        "Phường Khánh Hội",  # Từ P.8 + P.9 + P.10 + P.6 + một phần P.2 + một phần P.4 + một phần P.15
        "Phường Xóm Chiếu"  # Từ P.13 + P.14 + P.16 + P.18 + phần còn lại P.15
    ],
    "Quận 5": [
        "Phường Chợ Quán",  # Từ P.1 + P.2 + P.3 + P.4
        "Phường An Đông",  # Từ P.5 + P.6 + P.7 + P.8 + P.9
        "Phường Chợ Lớn"  # Từ P.10 + P.11 + P.12 + P.13 + P.14
    ],
    "Quận 6": [
        "Phường Bình Tiên",
        "Phường Bình Tây",
        "Phường Bình Phú",
        "Phường Phú Lâm"
    ],
    "Quận 7": [
        "Phường Tân Mỹ",
        "Phường Tân Hưng",
        "Phường Tân Thuận",
        "Phường Phú Thuận"
    ],
    "Quận 8": [
        "Phường Chánh Hưng",
        "Phường Bình Đông",
        "Phường Phú Định"
    ],
    "Quận 10": [
        "Phường Vườn Lài",  # Từ P.1 + P.2 + P.4 + P.9 + P.10 + P.11
        "Phường Diên Hồng",  # Từ P.5 + P.6 + P.7 + P.8 + P.14
        "Phường Hòa Hưng"  # Từ P.12 + P.13 + P.15
    ],
    "Quận 11": [
        "Phường Bình Thới",
        "Phường Phú Thọ",
        "Phường Hòa Bình",
        "Phường Minh Phụng"
    ],
    "Quận 12": [
        "Phường Đông Hưng Thuận",
        "Phường Trung Mỹ Tây",
        "Phường Tân Thới Hiệp",
        "Phường Thới An",
        "Phường An Phú Đông"
    ],
    "Quận Bình Thạnh": [
        "Phường Gia Định",
        "Phường Bình Thạnh",
        "Phường Bình Lợi Trung",
        "Phường Thạnh Mỹ Tây",
        "Phường Bình Quới"
    ],
    "Quận Tân Bình": [
        "Phường Tân Sơn Hòa",
        "Phường Tân Sơn Nhất",
        "Phường Tân Hòa",
        "Phường Bảy Hiền",
        "Phường Tân Bình",
        "Phường Tân Sơn"
    ],
    "Quận Tân Phú": [
        "Phường Tây Thạnh",
        "Phường Tân Sơn Nhì",
        "Phường Phú Thọ Hòa",
        "Phường Phú Thạnh",
        "Phường Tân Phú"
    ],
    "Quận Phú Nhuận": [
        "Phường Đức Nhuận",
        "Phường Cầu Kiệu",
        "Phường Phú Nhuận"
    ],
    "Quận Gò Vấp": [
        "Phường Hạnh Thông",
        "Phường An Nhơn",
        "Phường Gò Vấp",
        "Phường Thông Tây Hội",
        "Phường An Hội Tây",
        "Phường An Hội Đông"
    ],
    "Quận Thủ Đức": [
        "Phường Hiệp Bình",
        "Phường Tam Bình",
        "Phường Thủ Đức",
        "Phường Linh Xuân",
        "Phường Long Bình",
        "Phường Tăng Nhơn Phú",
        "Phường Phước Long",
        "Phường Long Phước",
        "Phường An Khánh",
        "Phường Bình Trưng",
        "Phường Cát Lái",
        "Phường Trường Thọ"
    ],
    "Huyện Bình Chánh": [
        "Xã Vĩnh Lộc",
        "Xã Tân Vĩnh Lộc",
        "Xã Bình Lợi",
        "Xã Tân Nhựt",
        "Xã Bình Chánh",
        "Xã Hưng Long",
        "Xã Bình Hưng"
    ],
    "Huyện Cần Giờ": [
        "Xã Bình Khánh",
        "Xã Cần Giờ",
        "Xã An Thới Đông",
        "Xã Thạnh An"
    ],
    "Huyện Củ Chi": [
        "Xã An Nhơn Tây",
        "Xã Thái Mỹ",
        "Xã Nhuận Đức",
        "Xã Tân An Hội",
        "Xã Củ Chi",
        "Xã Phú Hòa Đông",
        "Xã Bình Mỹ"
    ],
    "Huyện Hóc Môn": [
        "Xã Hóc Môn",
        "Xã Bà Điểm",
        "Xã Xuân Thới Sơn",
        "Xã Đông Thạnh"
    ],
    "Huyện Nhà Bè": [
        "Xã Nhà Bè",
        "Xã Hiệp Phước"
    ],
    "Quận Bình Tân": [
        "Phường Bình Tân",
        "Phường Bình Hưng Hòa",
        "Phường Bình Trị Đông",
        "Phường An Lạc",
        "Phường Tân Tạo"
    ]
}

def get_wards_from_district(district_name: str) -> List[str]:
    """
    Chuyển đổi tên quận cũ sang danh sách phường mới theo Nghị quyết 1685/NQ-UBTVQH15
    
    Args:
        district_name: Tên quận cũ (VD: "Quận 1", "Q1", "Q.3", "Tân Bình", "Bình Thạnh")
    
    Returns:
        List[str]: Danh sách tên phường mới
    """
    # Chuẩn hóa tên quận
    district_normalized = district_name.strip()
    
    # Xử lý các biến thể viết tắt
    if district_normalized.upper().startswith("Q"):
        # "Q1" -> "Quận 1", "Q.3" -> "Quận 3", "Q 5" -> "Quận 5"
        num = district_normalized.replace("Q", "").replace(".", "").replace(" ", "").strip()
        if num.isdigit():
            district_normalized = f"Quận {num}"
    
    # Xử lý tên quận bằng chữ (không có số)
    district_mapping = {
        "Tân Bình": "Quận Tân Bình",
        "Tân Phú": "Quận Tân Phú",
        "Bình Thạnh": "Quận Bình Thạnh",
        "Phú Nhuận": "Quận Phú Nhuận",
        "Gò Vấp": "Quận Gò Vấp",
        "Thủ Đức": "Quận Thủ Đức",
        "Bình Tân": "Quận Bình Tân",
        "Bình Chánh": "Huyện Bình Chánh",
        "Cần Giờ": "Huyện Cần Giờ",
        "Củ Chi": "Huyện Củ Chi",
        "Hóc Môn": "Huyện Hóc Môn",
        "Nhà Bè": "Huyện Nhà Bè",
    }
    
    district_normalized = district_mapping.get(district_normalized, district_normalized)
    
    return DISTRICT_TO_WARDS.get(district_normalized, [])

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

    @staticmethod
    def _validate_rating_value(value: float, field_name: str) -> Optional[float]:
        """Validate rating value trong khoảng 1.0-10.0"""
        if value is None:
            return None
        try:
            val = float(value)
            if 1.0 <= val <= 10.0:
                return val
            else:
                logger.warning(f"[VALIDATION] {field_name} value {val} out of range [1.0-10.0], ignoring")
                return None
        except (ValueError, TypeError):
            logger.warning(f"[VALIDATION] {field_name} value {value} is not a valid number, ignoring")
            return None

    @staticmethod
    def _validate_count_value(value: int, field_name: str) -> Optional[int]:
        """Validate count value phải >= 0"""
        if value is None:
            return None
        try:
            val = int(value)
            if val >= 0:
                return val
            else:
                logger.warning(f"[VALIDATION] {field_name} value {val} must be >= 0, ignoring")
                return None
        except (ValueError, TypeError):
            logger.warning(f"[VALIDATION] {field_name} value {value} is not a valid integer, ignoring")
            return None

    def _concatenate_previous_queries(self, session_history: List[Dict], current_query: str, max_queries: int = 10) -> str:
        """Nối các query trước đó trong session với query hiện tại"""
        previous_queries = []
        for msg in session_history[-20:]:  # Lấy 20 message gần nhất để đảm bảo có đủ user queries
            if msg.get("role") == "user" and "content" in msg:
                content = msg["content"]
                if isinstance(content, list) and len(content) > 0:
                    text = content[0].get("text", "")
                    if text:
                        previous_queries.append(text)
        
        # Lấy N query gần nhất (không tính query hiện tại)
        previous_queries = previous_queries[-max_queries:]
        
        # Nối tất cả query lại
        if previous_queries:
            combined_query = " ".join(previous_queries + [current_query])
            logger.info(f"[QUERY CONCAT] Nối {len(previous_queries)} query trước: {combined_query[:200]}...")
            return combined_query
        else:
            return current_query

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
        if not text_input: 
            return None
        
        # Check cache trước
        cache_key = get_cache_key(text_input)
        if cache_key in EMBEDDING_CACHE:
            # Move to end (most recently used)
            EMBEDDING_CACHE.move_to_end(cache_key)
            logger.info(f"[CACHE HIT] Embedding cached for: {text_input[:50]}...")
            return EMBEDDING_CACHE[cache_key]
        
        # Nếu không có trong cache, gọi Bedrock
        logger.info(f"[CACHE MISS] Calling Bedrock for: {text_input[:50]}...")
        body = json.dumps({"inputText": text_input, "dimensions": 1024, "normalize": True})
        try:
            response = self.bedrock.invoke_model(modelId=MODEL_EMBED, body=body)
            embedding = json.loads(response["body"].read())["embedding"]
            
            # Lưu vào cache với LRU eviction
            if len(EMBEDDING_CACHE) >= MAX_CACHE_SIZE:
                # Remove oldest item (first item)
                EMBEDDING_CACHE.popitem(last=False)
                logger.info(f"[CACHE] Evicted oldest item. Cache size: {len(EMBEDDING_CACHE)}/{MAX_CACHE_SIZE}")
            
            EMBEDDING_CACHE[cache_key] = embedding
            EMBEDDING_CACHE.move_to_end(cache_key)  # Move to end (most recently used)
            logger.info(f"[CACHE] Stored embedding. Cache size: {len(EMBEDDING_CACHE)}/{MAX_CACHE_SIZE}")
            
            return embedding
        except ClientError as e:
            logger.error(f"[BEDROCK ERROR] Embedding Error: {e}")
            return None
        except Exception as e:
            logger.error(f"[UNEXPECTED ERROR] Embedding Error: {e}")
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
                                1. Nếu user tìm 'cafe', 'nước', 'trà sữa',... -> CHỈ lấy ['Cà phê', 'Trà sữa', 'Giải khát',...]. TUYỆT ĐỐI KHÔNG thêm 'Quán ăn', 'Nhà hàng'...
                                2. Nếu user tìm 'ăn', 'cơm',... -> Lấy ['Nhà hàng', 'Quán ăn', 'Món Việt', ...].
                                3. Nếu user tìm 'nhậu' -> Lấy ['Quán nhậu', 'Beer', 'Bar',...].
                                4. Nếu user tìm MÓN CỤ THỂ (VD: 'BBQ', 'Lẩu', 'Sushi', 'Pizza', 'Chay',...) -> CHỈ lấy business_type đó.
                                (VD: Tìm 'BBQ' -> ['Nướng', 'Buffet', 'Grill']. KHÔNG lấy 'phở', 'cơm',...).
                                Hãy chọn business_type sát nhất với từ khóa của user.
                                5. Nếu user tìm ĐẶC ĐIỂM RIÊNG (VD: 'Rooftop', 'View đẹp', 'Sân vườn', 'Cá Koi', 'Mèo',...) -> CHỈ lấy business_type chứa đặc điểm đó (VD: ['Rooftop', 'Sân vườn', 'View']). 
                                6. Nếu user tìm 'Bar', 'Pub', 'Club', 'Quẩy' -> 
                                - Lấy ['Bar', 'Pub', 'Club', 'Nightlife', 'Lounge'].
                                7. LOGIC ĐẶC BIỆT KHI USER TIÊU CỰC (Chửi thề, buồn, chán):
                                - Nếu user đang bực bội/chửi (mood='negative'), hãy TỰ ĐỘNG gợi ý các món 'Giải sầu' phù hợp:
                                    + ['Quán nhậu', 'Bia', 'Bar',...] (để xả stress).
                                    + ['Đồ ngọt', 'Trà sữa', 'Bánh',...] (để user thấy ngọt ngào hơn).
                                    + ['Lẩu', 'Nướng',...] (ăn cho đã cơn thèm).
                                - Đừng trả về danh sách trống khi user chửi bậy. Hãy lấp đầy bằng các món trên.                      
                                """},
                                "mood": {
                                    "type": "string",
                                    "enum": ["neutral", "negative"],
                                    "description": "Nếu user chửi thề, dùng từ ngữ tiêu cực, than vãn, buồn bã -> Đặt là 'negative'. Còn lại là 'neutral'."
                                },
                                "rating_service_min": {"type": "number", "description": "Rating service tối thiểu (1.0-10.0). VD: User nói 'service tốt' -> 7.0, 'service xuất sắc' -> 8.5. Nếu không đề cập thì null."},
                                "rating_service_max": {"type": "number", "description": "Rating service tối đa (1.0-10.0). VD: User nói 'service từ 7 đến 9' -> 9.0. Nếu không đề cập thì null."},
                                "rating_location_min": {"type": "number", "description": "Rating location tối thiểu (1.0-10.0). VD: User nói 'vị trí đẹp', 'location tốt' -> 7.0. Nếu không đề cập thì null."},
                                "rating_location_max": {"type": "number", "description": "Rating location tối đa (1.0-10.0). Nếu không đề cập thì null."},
                                "rating_price_min": {"type": "number", "description": "Rating price tối thiểu (1.0-10.0). VD: User nói 'giá hợp lý' -> 6.0, 'giá tốt' -> 7.0. Lưu ý: rating_price cao = giá rẻ/hợp lý. Nếu không đề cập thì null."},
                                "rating_price_max": {"type": "number", "description": "Rating price tối đa (1.0-10.0). Nếu không đề cập thì null."},
                                "rating_quality_min": {"type": "number", "description": "Rating quality tối thiểu (1.0-10.0). VD: User nói 'chất lượng tốt', 'món ngon' -> 7.0. Nếu không đề cập thì null."},
                                "rating_quality_max": {"type": "number", "description": "Rating quality tối đa (1.0-10.0). Nếu không đề cập thì null."},
                                "rating_ambiance_min": {"type": "number", "description": "Rating ambiance tối thiểu (1.0-10.0). VD: User nói 'không gian đẹp', 'ambiance tốt' -> 7.0. Nếu không đề cập thì null."},
                                "rating_ambiance_max": {"type": "number", "description": "Rating ambiance tối đa (1.0-10.0). Nếu không đề cập thì null."},
                                "rating_overall_min": {"type": "number", "description": "Rating tổng thể tối thiểu (1.0-10.0). VD: User nói 'rating trên 8', 'quán tốt' -> 8.0, 'quán xuất sắc' -> 9.0. Nếu không đề cập thì null."},
                                "rating_overall_max": {"type": "number", "description": "Rating tổng thể tối đa (1.0-10.0). VD: User nói 'rating từ 7 đến 9' -> 9.0. Nếu không đề cập thì null."},
                                "min_rating_count": {"type": "integer", "description": "Số lượng rating tối thiểu. VD: User nói 'quán có nhiều đánh giá', 'nhiều người rate' -> 20. Nếu không đề cập thì null."},
                                "min_review_count": {"type": "integer", "description": "Số lượng review tối thiểu. VD: User nói 'quán nhiều review', 'nhiều người review' -> 50. Nếu không đề cập thì null."},
                                "min_favorite_count": {"type": "integer", "description": "Số lượng favorite tối thiểu. VD: User nói 'quán được yêu thích', 'nhiều người thích' -> 10. Nếu không đề cập thì null."},
                                "min_view_count": {"type": "integer", "description": "Số lượng view tối thiểu. VD: User nói 'quán nhiều người xem', 'phổ biến' -> 100. Nếu không đề cập thì null."}               
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
        except ClientError as e:
            logger.error(f"[BEDROCK ERROR] parse_intent failed: {e}")
            return {"search_text": user_input, "search_strategy": "semantic"}
        except Exception as e:
            logger.error(f"[UNEXPECTED ERROR] parse_intent failed: {e}")
            return {"search_text": user_input, "search_strategy": "semantic"}

    def _build_base_query(self, query_text: str, strategy: str, query_emb: List[float]) -> tuple:
        """Build base SQL query với scoring"""
        emb_literal = "[" + ",".join(map(str, query_emb)) + "]"
        
        if strategy == "precise":
            w_text, w_vec = 0.7, 0.3
        else:
            w_text, w_vec = 0.3, 0.7

        clean_query = " | ".join(query_text.replace("!", "").replace("&", "").split())

        sql_base = f"""
        SELECT id, name_vi, slug, address, price_min, price_max, "opening_hours", business_type,
            rating_service, rating_location, rating_price, rating_quality, rating_ambiance, rating_overall,
            rating_count, review_count, favorite_count, view_count,
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
        
        if strategy == "precise":
            sql_base += " AND search_vector @@ to_tsquery('simple', unaccent(:query_ts))"
        
        return sql_base, sql_params

    def _build_district_filter(self, sql_base: str, sql_params: Dict, district: str) -> tuple:
        """Build district filter với ward mapping"""
        if not district:
            return sql_base, sql_params
        
        wards = get_wards_from_district(district)
        if wards:
            ward_conditions = []
            for i, ward in enumerate(wards):
                param_name = f"ward_{i}"
                ward_conditions.append(f"(address ILIKE :{param_name} OR ward ILIKE :{param_name})")
                sql_params[param_name] = f"%{ward}%"
            
            if ward_conditions:
                sql_base += f" AND ({' OR '.join(ward_conditions)})"
                logger.info(f"[DISTRICT MAPPING] Quận '{district}' -> {len(wards)} phường: {', '.join(wards[:3])}{'...' if len(wards) > 3 else ''}")
        else:
            sql_base += " AND address ILIKE :district"
            sql_params["district"] = f"%{district}%"
            logger.warning(f"[DISTRICT FALLBACK] Không tìm thấy mapping cho '{district}', tìm trực tiếp trong address")
        
        return sql_base, sql_params

    def _build_price_filter(self, sql_base: str, sql_params: Dict, min_price: Optional[int], max_price: Optional[int]) -> tuple:
        """Build price filter"""
        if max_price:
            sql_base += " AND price_min <= :max_p"
            sql_params["max_p"] = max_price
            
        if min_price:
            sql_base += " AND price_max >= :min_p"
            sql_params["min_p"] = min_price
        
        return sql_base, sql_params

    def _build_time_filter(self, sql_base: str, sql_params: Dict, is_open_now: bool) -> tuple:
        """Build opening hours filter"""
        if not is_open_now:
            return sql_base, sql_params
        
        now = datetime.now(VN_TZ)
        sql_params["now"] = now.strftime("%H:%M:00")
        sql_base += """
            AND (
                "opening_hours" ILIKE '%Cả ngày%' 
                OR (
                    "opening_hours" ~ '^\\d{2}:\\d{2} - \\d{2}:\\d{2}$'
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
        return sql_base, sql_params

    def _build_keyword_filters(self, sql_base: str, sql_params: Dict, params: Dict[str, Any]) -> tuple:
        """Build exclude_keywords, exclude_districts, target_categories filters"""
        # Exclude keywords
        if params.get("exclude_keywords"):
            for i, keyword in enumerate(params["exclude_keywords"]):
                arg_name = f"exclude_{i}"
                sql_base += f""" 
                    AND NOT (
                        name_vi ILIKE :{arg_name} 
                        OR business_type ILIKE :{arg_name}
                        OR description ILIKE :{arg_name}
                    )
                """
                sql_params[arg_name] = f"%{keyword}%"

        # Exclude districts
        if params.get("exclude_districts"):
            for i, dist in enumerate(params["exclude_districts"]):
                arg_name = f"ex_dist_{i}"
                sql_base += f" AND address NOT ILIKE :{arg_name}"
                sql_params[arg_name] = f"%{dist}%"
        
        # Target categories
        if params.get("target_categories"):
            or_conditions = []
            for i, cat in enumerate(params["target_categories"]):
                arg_name = f"inc_cat_{i}"
                or_conditions.append(f"(business_type ILIKE :{arg_name} OR name_vi ILIKE :{arg_name})")
                sql_params[arg_name] = f"%{cat}%"
            
            if or_conditions:
                sql_base += f" AND ({' OR '.join(or_conditions)})"
        
        return sql_base, sql_params

    def _build_rating_filters(self, sql_base: str, sql_params: Dict, params: Dict[str, Any]) -> tuple:
        """Build rating filters với validation"""
        rating_fields = [
            "rating_service", "rating_location", "rating_price", 
            "rating_quality", "rating_ambiance", "rating_overall"
        ]
        
        for field in rating_fields:
            min_key = f"{field}_min"
            max_key = f"{field}_max"
            
            min_val = self._validate_rating_value(params.get(min_key), min_key)
            max_val = self._validate_rating_value(params.get(max_key), max_key)
            
            if min_val is not None:
                sql_base += f" AND {field} >= :{min_key}"
                sql_params[min_key] = min_val
            
            if max_val is not None:
                sql_base += f" AND {field} <= :{max_key}"
                sql_params[max_key] = max_val
        
        return sql_base, sql_params

    def _build_count_filters(self, sql_base: str, sql_params: Dict, params: Dict[str, Any]) -> tuple:
        """Build count filters với validation"""
        count_fields = [
            ("min_rating_count", "rating_count"),
            ("min_review_count", "review_count"),
            ("min_favorite_count", "favorite_count"),
            ("min_view_count", "view_count")
        ]
        
        for param_key, db_field in count_fields:
            val = self._validate_count_value(params.get(param_key), param_key)
            if val is not None:
                sql_base += f" AND {db_field} >= :{param_key}"
                sql_params[param_key] = val
        
        return sql_base, sql_params

    def execute_db_search(self, params: Dict[str, Any], min_score: float = 0.0):
        start_time = datetime.now() # Bắt đầu đếm giờ SQL
        
        if not engine:
            raise Exception("Database Engine is NOT connected. Check AWS Secrets or Network.")

        query_text = params.get("search_text", "")
        strategy = params.get("search_strategy", "semantic")
        
        query_emb = self.get_embedding(query_text)
        if not query_emb: 
            return []

        # Build base query
        sql_base, sql_params = self._build_base_query(query_text, strategy, query_emb)
        
        # Build filters
        sql_base, sql_params = self._build_district_filter(sql_base, sql_params, params.get("district"))
        sql_base, sql_params = self._build_price_filter(sql_base, sql_params, params.get("min_price"), params.get("max_price"))
        sql_base, sql_params = self._build_time_filter(sql_base, sql_params, params.get("is_open_now", False))
        sql_base, sql_params = self._build_keyword_filters(sql_base, sql_params, params)
        sql_base, sql_params = self._build_rating_filters(sql_base, sql_params, params)
        sql_base, sql_params = self._build_count_filters(sql_base, sql_params, params)

        sql_base += " ORDER BY final_score DESC LIMIT 10;"

        try:
            with engine.connect() as conn:
                rows = conn.execute(text(sql_base), sql_params).fetchall()
                results = [row for row in rows if row.final_score is not None and row.final_score >= min_score]
                
                # --- LOGGING PHẦN SQL ---
                duration = (datetime.now() - start_time).total_seconds()
                top_score = results[0].final_score if results else 0
                logger.info(f"[SQL] Found: {len(results)} items | Time: {duration:.2f}s | Top Score: {top_score:.4f} | Filters: {params}")
                
                return results
        except Exception as e:
            logger.error(f"[SQL ERROR] Query failed: {e}")
            logger.error(f"[SQL ERROR] Query: {sql_base[:500]}...")
            logger.error(f"[SQL ERROR] Params keys: {list(sql_params.keys())}")
            raise

    def _relax_rating_filters(self, params: Dict[str, Any], relax_by: float = 1.0) -> Dict[str, Any]:
        """Relax rating filters bằng cách giảm min values đi relax_by điểm"""
        relaxed = params.copy()
        rating_fields = [
            "rating_service", "rating_location", "rating_price", 
            "rating_quality", "rating_ambiance", "rating_overall"
        ]
        
        for field in rating_fields:
            min_key = f"{field}_min"
            if min_key in relaxed and relaxed[min_key] is not None:
                original_val = relaxed[min_key]
                relaxed_val = max(1.0, original_val - relax_by)  # Không được < 1.0
                relaxed[min_key] = relaxed_val
                logger.info(f"[RATING RELAX] {min_key}: {original_val} -> {relaxed_val}")
        
        return relaxed

    def search_pipeline(self, params):
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

        # 3. Relax Rating Filters (giảm 1 điểm)
        has_rating_filters = any(k in params for k in [
            "rating_service_min", "rating_location_min", "rating_price_min",
            "rating_quality_min", "rating_ambiance_min", "rating_overall_min"
        ])
        if has_rating_filters:
            relaxed_rating_params = self._relax_rating_filters(params, relax_by=1.0)
            logger.info(f"⚠️ Trigger Fallback 2 (Relax Rating by 1.0)")
            results = self.execute_db_search(relaxed_rating_params, min_score=0.2)
            if results: return results, "Không đúng rating yêu cầu, nhưng có quán gần đúng:"

        # 4. Relax District
        if "district" in params:
            d_params = params.copy()
            del d_params["district"]
            d_params.pop("is_open_now", None)
            logger.info(f"⚠️ Trigger Fallback 3 (Drop District)")
            results = self.execute_db_search(d_params, min_score=0.2)
            if results: return results, f"Quận {params['district']} không có, nhưng chỗ khác có:"

        # 5. Semantic Only
        logger.info(f"⚠️ Trigger Fallback 4 (Semantic Only)")
        results = self.execute_db_search({"search_text": params["search_text"], "search_strategy": "semantic"}, min_score=0.25)
        if results: return results, "Tìm theo vibe/ngữ nghĩa:"
        
        return [], ""

    def get_restaurant_images(self, restaurant_ids: List[str]) -> Dict[str, str]:
        """Lấy ảnh đầu tiên của mỗi restaurant từ table photos"""
        if not restaurant_ids or not engine:
            return {}
        
        if len(restaurant_ids) == 0:
            return {}
        
        try:
            # Tối ưu: dùng ANY array thay vì IN với nhiều placeholders
            # Tạo placeholder cho các restaurant_id
            placeholders = ", ".join([f":id_{i}" for i in range(len(restaurant_ids))])
            sql_query = f"""
                SELECT DISTINCT ON (restaurant_id) 
                    restaurant_id, s3_url
                FROM photos 
                WHERE restaurant_id IN ({placeholders})
                    AND s3_url IS NOT NULL
                    AND s3_url != ''
                ORDER BY restaurant_id, created_at DESC
            """
            
            params = {f"id_{i}": rid for i, rid in enumerate(restaurant_ids)}
            
            with engine.connect() as conn:
                rows = conn.execute(text(sql_query), params).fetchall()
                return {row.restaurant_id: row.s3_url for row in rows}
        except Exception as e:
            logger.error(f"[IMAGE ERROR] Error fetching restaurant images: {e}")
            logger.error(traceback.format_exc())
            return {}

    def generate_response_and_data(self, user_input, results, system_note, user_mood="neutral"):
        if not results:
            if user_mood == "negative":
                return "Nghe vẻ bạn đang có chuyện không vui, nhưng tiếc là mình chưa tìm được quán nào phù hợp để giải sầu lúc này. Thử lại khu vực khác xem sao nhé! 🍺", []
            return "Xin lỗi, không tìm thấy quán nào phù hợp. 😅", []

        # Lấy ảnh cho tất cả restaurants
        restaurant_ids = [row.id for row in results]
        images_map = self.get_restaurant_images(restaurant_ids)

        restaurants_data = []
        context_str = ""
        for row in results:
            p_min = int(row.price_min) if row.price_min else 0
            p_max = int(row.price_max) if row.price_max else 0
            price_display = f"{p_min:,} - {p_max:,} VNĐ" if (p_min or p_max) else "Đang cập nhật"
            item = {
                "id": row.id, 
                "name": row.name_vi,
                "slug": row.slug,
                "address": row.address or "N/A",
                "priceRange": price_display, 
                "hours": row.opening_hours or "N/A",
                "business_type": row.business_type, 
                "score": f"{row.final_score:.2f}",
                "image": images_map.get(row.id)
            }
            restaurants_data.append(item)
            context_str += f"- {item['name']} ({item['address']}) | Giá: {item['priceRange']} | Giờ: {item['hours']} | Loại: {item['business_type']}\n"


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
        except ClientError as e:
            logger.error(f"[BEDROCK ERROR] generate_response failed: {e}")
            return "Dưới đây là danh sách quán.", restaurants_data
        except (KeyError, IndexError) as e:
            logger.error(f"[RESPONSE PARSE ERROR] Failed to parse response: {e}")
            return "Dưới đây là danh sách quán.", restaurants_data
        except Exception as e:
            logger.error(f"[UNEXPECTED ERROR] generate_response failed: {e}")
            return "Dưới đây là danh sách quán.", restaurants_data

# --- 5. API ENDPOINT ---
@app.get("/")
def health_check():
    return {"status": "ok", "service": "VN Food RAG"}

@app.post("/search")
async def search_endpoint(payload: SearchPayload):
    # --- LOG START REQUEST ---
    try:
        logger.info(f"\n{'='*20} NEW REQUEST [Session: {payload.session_id}] {'='*20}")
        logger.info(f"[USER QUERY] {payload.query}")

        
        session_mgr = USER_SESSIONS.get(payload.session_id, [])
        if payload.is_new_topic: session_mgr = []
        
        rag = RAGService(payload.session_id, session_mgr)

        # Nối 10 query trước đó vào query hiện tại
        combined_query = rag._concatenate_previous_queries(session_mgr, payload.query, max_queries=10)

        # Pipeline
        params = rag.parse_intent(combined_query)
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
    except ValueError as e:
        logger.error(f"[VALIDATION ERROR] {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"Validation error: {str(e)}",
            "type": "ValueError"
        }
    except ClientError as e:
        logger.error(f"[AWS ERROR] {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"AWS service error: {str(e)}",
            "type": "ClientError"
        }
    except Exception as e:
        # --- TRẢ VỀ LỖI CHI TIẾT RA POSTMAN ---
        logger.error(f"[CRITICAL ERROR] {str(e)}")
        logger.error(traceback.format_exc()) # Log traceback đầy đủ lên CloudWatch

        return {
            "status": "error",
            "message": str(e),
            "type": type(e).__name__,
            "hint": "Check CloudWatch logs for full traceback."
        }

# --- 6. HANDLER CHO LAMBDA ---
handler = Mangum(app)