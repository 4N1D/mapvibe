import os
import json
import re
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
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    force=True  # Force reconfiguration để đảm bảo settings được apply
)
logger = logging.getLogger(__name__)

# Đảm bảo logs được flush ngay lập tức (quan trọng cho Lambda)
import sys
for handler in logger.handlers:
    handler.setLevel(logging.INFO)
# Thêm StreamHandler nếu chưa có để đảm bảo logs được ghi
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

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
    # Cache tool_spec ở class level để không tạo lại mỗi lần
    _TOOL_SPEC = None
    
    def __init__(self, session_id: str, history: List[Dict]):
        self.session_id = session_id
        self.history = history
        self.bedrock = bedrock_client

    @classmethod
    def _get_tool_spec(cls):
        """Lấy tool_spec, tạo 1 lần và cache lại"""
        if cls._TOOL_SPEC is None:
            cls._TOOL_SPEC = {
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
            logger.info("[TOOL_SPEC] Initialized and cached tool_spec")
        return cls._TOOL_SPEC

    @staticmethod
    def _validate_rating_value(value: float, field_name: str) -> Optional[float]:
        """Validate rating value trong khoảng 1.0-10.0"""
        if value is None or value == "null" or value == "NULL":
            return None
        try:
            val = float(value)
            if 1.0 <= val <= 10.0:
                return val
            else:
                logger.warning(f"[VALIDATION] {field_name} value {val} out of range [1.0-10.0], ignoring")
                return None
        except (ValueError, TypeError):
            # Không log warning nếu là None/null (bình thường)
            if value not in [None, "null", "NULL", ""]:
                logger.warning(f"[VALIDATION] {field_name} value {value} is not a valid number, ignoring")
            return None

    @staticmethod
    def _validate_count_value(value: int, field_name: str) -> Optional[int]:
        """Validate count value phải >= 0"""
        if value is None or value == "null" or value == "NULL":
            return None
        try:
            val = int(value)
            if val >= 0:
                return val
            else:
                logger.warning(f"[VALIDATION] {field_name} value {val} must be >= 0, ignoring")
                return None
        except (ValueError, TypeError):
            # Không log warning nếu là None/null (bình thường)
            if value not in [None, "null", "NULL", ""]:
                logger.warning(f"[VALIDATION] {field_name} value {value} is not a valid integer, ignoring")
            return None

    def _summarize_context(self, session_history: List[Dict], max_messages: int = 10) -> str:
        """
        Dùng LLM để tóm tắt context từ history thành keywords/entities ngắn gọn
        Chỉ giữ lại thông tin quan trọng cho search
        """
        if not session_history:
            return ""
        
        # Lấy các message gần nhất (user + assistant để hiểu context)
        recent_messages = session_history[-max_messages * 2:]  # *2 vì có cả user và assistant
        
        if not recent_messages:
            return ""
        
        # Tạo context string từ messages
        context_text = ""
        for msg in recent_messages:
            role = msg.get("role", "")
            content = msg.get("content", [])
            if isinstance(content, list) and len(content) > 0:
                text = content[0].get("text", "")
                if text:
                    context_text += f"{role}: {text}\n"
        
        if not context_text.strip():
            return ""
        
        # Dùng LLM Haiku để tóm tắt context
        summarize_prompt = f"""Bạn là context summarizer. Nhiệm vụ của bạn là tóm tắt lịch sử hội thoại thành keywords/entities ngắn gọn để dùng cho search engine.

LỊCH SỬ HỘI THOẠI:
{context_text}

Hãy tóm tắt thành format ngắn gọn:
- Keywords quan trọng (tên món, loại quán, địa điểm)
- Entities (quận, huyện, đặc điểm)
- Filters đã đề cập (giá, rating, giờ mở cửa)

CHỈ giữ lại thông tin QUAN TRỌNG và LIÊN QUAN. Loại bỏ thông tin không cần thiết.
Nếu không có thông tin quan trọng, trả về chuỗi rỗng.
"""
        
        try:
            messages = [{"role": "user", "content": [{"text": summarize_prompt}]}]
            response = self.call_bedrock_retry(
                model_id=MODEL_INTENT,
                messages=messages,
                system_prompts=[{"text": "Bạn là context summarizer chuyên nghiệp. Tóm tắt ngắn gọn, chính xác."}]
            )
            
            summary = response['output']['message']['content'][0]['text'].strip()
            logger.info(f"[CONTEXT SUMMARY] {summary[:200]}...")
            return summary
        except Exception as e:
            logger.warning(f"[CONTEXT SUMMARY ERROR] Failed to summarize context: {e}, using empty context")
            return ""

    def _rewrite_query_for_search(self, current_query: str, context_summary: str) -> str:
        """
        Dùng LLM để rewrite query hiện tại dựa trên context thành search query tối ưu
        Tự động detect topic change và loại bỏ context không liên quan
        
        QUAN TRỌNG: Chỉ thêm context khi query hiện tại THỰC SỰ liên quan đến context.
        Nếu query mới/chung chung (VD: "quán nào rẻ thôi"), KHÔNG thêm context cũ.
        """
        if not context_summary:
            # Không có context, trả về query gốc
            return current_query
        
        rewrite_prompt = f"""Bạn là search query optimizer. Nhiệm vụ của bạn là rewrite query hiện tại dựa trên context để tạo ra search query tối ưu.

CONTEXT (từ các query trước):
{context_summary}

QUERY HIỆN TẠI:
{current_query}

QUY TẮC QUAN TRỌNG:
1. Nếu query hiện tại là QUERY CHUNG CHUNG hoặc KHÔNG chỉ định rõ (VD: "quán nào rẻ thôi", "có gì ngon không", "gợi ý đi"), 
   -> CHỈ trả về query hiện tại đã được làm sạch, KHÔNG thêm BẤT KỲ context cũ nào (KHÔNG thêm location, KHÔNG thêm categories, KHÔNG thêm price).

2. Nếu query hiện tại ĐỔI TOPIC hoàn toàn (VD: từ "quán nướng" sang "quán cafe"), 
   -> CHỈ trả về query hiện tại, LOẠI BỎ toàn bộ context cũ.

3. CHỈ kết hợp context khi:
   - Query hiện tại TIẾP TỤC/REFINE topic cũ (VD: "quán nướng" -> "quán nướng nào rẻ")
   - Query hiện tại có từ chỉ định rõ (VD: "quán nướng ở Q7", "buffet giá tốt")
   - Query hiện tại là câu hỏi follow-up rõ ràng (VD: "còn quán nào khác không", "quán nào gần hơn")

4. Khi kết hợp context, TUYỆT ĐỐI TUÂN THỦ:
   - Location (quận, huyện, địa điểm): CHỈ thêm nếu query hiện tại CÓ đề cập đến location. Nếu query hiện tại KHÔNG nói gì về location, TUYỆT ĐỐI KHÔNG thêm location từ context.
   - Categories (loại quán, món ăn): CHỈ thêm nếu query hiện tại CÓ đề cập đến loại quán/món. Nếu query hiện tại KHÔNG nói gì về loại quán (VD: "quán nào rẻ thôi"), TUYỆT ĐỐI KHÔNG thêm categories từ context.
   - Price range: CHỈ thêm nếu query hiện tại CÓ đề cập đến giá cụ thể (VD: "dưới 100k", "100k-200k"). Nếu query hiện tại chỉ nói "rẻ", "giá tốt" -> KHÔNG thêm price range cụ thể từ context.

5. LOẠI BỎ:
   - Từ dư thừa ("này", "có gì", "thì", "mà", "vậy", ...)
   - Câu hỏi không cần thiết
   - Từ lặp lại
   - Context không liên quan đến query hiện tại

Output CHỈ là search query đã được rewrite, KHÔNG giải thích, KHÔNG thêm từ nào khác.
Nếu query hiện tại là query chung chung hoặc không liên quan context, chỉ trả về query hiện tại đã được làm sạch.
"""
        
        try:
            messages = [{"role": "user", "content": [{"text": rewrite_prompt}]}]
            response = self.call_bedrock_retry(
                model_id=MODEL_INTENT,
                messages=messages,
                system_prompts=[{"text": "Bạn là search query optimizer. Rewrite query ngắn gọn, chính xác, chỉ output query không giải thích."}]
            )
            
            rewritten = response['output']['message']['content'][0]['text'].strip()
            logger.info(f"[QUERY REWRITE] '{current_query}' -> '{rewritten}'")
            return rewritten
        except Exception as e:
            logger.warning(f"[QUERY REWRITE ERROR] Failed to rewrite query: {e}, using original query")
            return current_query

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

    @staticmethod
    def _has_location_keywords(text: str) -> bool:
        """Kiểm tra xem text có chứa location keywords không"""
        if not text:
            return False
        
        text_lower = text.lower()
        # Các từ khóa về location
        location_keywords = [
            'quận', 'q.', 'q ', 'huyện', 'phường', 'xã',
            'tân bình', 'bình thạnh', 'thủ đức', 'gò vấp', 'phú nhuận',
            'quận 1', 'quận 2', 'quận 3', 'quận 4', 'quận 5', 'quận 6', 'quận 7', 'quận 8', 'quận 9', 'quận 10', 'quận 11', 'quận 12',
            'ở', 'tại', 'gần', 'khu vực', 'địa điểm', 'vị trí',
            'long bình', 'tân sơn', 'bình tân', 'cần giờ', 'củ chi', 'hóc môn', 'nhà bè'
        ]
        
        return any(keyword in text_lower for keyword in location_keywords)
    
    @staticmethod
    def _has_category_keywords(text: str) -> bool:
        """Kiểm tra xem text có chứa category keywords không"""
        if not text:
            return False
        
        text_lower = text.lower()
        # Các từ khóa về category/loại quán
        category_keywords = [
            'quán', 'nhà hàng', 'cafe', 'cà phê', 'trà sữa', 'bánh', 'chè',
            'nướng', 'bbq', 'grill', 'buffet', 'lẩu', 'sushi', 'pizza',
            'chay', 'món việt', 'món nhật', 'món hàn', 'món thái',
            'nhậu', 'bar', 'pub', 'club', 'beer', 'bia',
            'steak', 'pasta', 'burger', 'gà', 'phở', 'bún', 'cơm'
        ]
        
        return any(keyword in text_lower for keyword in category_keywords)

    def parse_intent(self, user_input: str, context_summary: str = "", original_query: str = "") -> Dict[str, Any]:
        """
        Dùng CLAUDE HAIKU + Tool Use để parse intent từ query đã được rewrite
        
        QUAN TRỌNG: Chỉ extract filters mà user THỰC SỰ yêu cầu trong original_query,
        không phải từ context đã được inject vào rewritten query.
        """
        current_time = datetime.now(VN_TZ).strftime("%H:%M")
        
        # Dùng cached tool_spec
        tool_spec = self._get_tool_spec()

        # Nếu không có original_query, dùng user_input làm original (fallback)
        if not original_query:
            original_query = user_input

        # Đơn giản hóa messages payload - chỉ dùng query hiện tại (đã được rewrite với context)
        messages_payload = [{"role": "user", "content": [{"text": user_input}]}]
        
        # Cải thiện system prompt với instructions rõ ràng
        system_prompt_text = f"""Bạn là intent parser chuyên nghiệp. Nhiệm vụ của bạn là trích xuất chính xác thông tin từ query để tìm kiếm nhà hàng/quán ăn.

Giờ hiện tại: {current_time}

QUERY GỐC CỦA USER (quan trọng nhất):
"{original_query}"

QUERY ĐÃ ĐƯỢC TỐI ƯU (có thể chứa context):
"{user_input}"
"""
        
        if context_summary:
            system_prompt_text += f"""
CONTEXT TỪ SESSION (chỉ để tham khảo):
{context_summary}
"""
        
        system_prompt_text += """
QUY TẮC TRÍCH XUẤT (RẤT QUAN TRỌNG):

1. ƯU TIÊN QUERY GỐC: Chỉ extract filters/categories/location/price mà user THỰC SỰ đề cập trong QUERY GỐC.

2. Nếu QUERY GỐC là query chung chung (VD: "quán nào rẻ thôi", "có gì ngon không", "gợi ý đi"):
   - KHÔNG extract categories từ context (VD: nếu context có "quán nướng" nhưng query gốc không nói, thì KHÔNG thêm categories)
   - KHÔNG extract location từ context (VD: nếu context có "Q7" nhưng query gốc không nói, thì KHÔNG thêm district)
   - CHỈ extract filters mà query gốc thực sự yêu cầu (VD: "rẻ" -> chỉ set rating_price_min, KHÔNG set categories/location)

3. Nếu QUERY GỐC có thông tin cụ thể:
   - Extract đầy đủ từ query gốc
   - Có thể tham khảo context để làm rõ thêm (VD: query gốc nói "quán nướng" + context có "Q7" -> có thể thêm district nếu hợp lý)

4. Categories (target_categories):
   - CHỈ extract khi query gốc đề cập đến loại quán/món cụ thể
   - Nếu query gốc không nói gì về loại quán (VD: "quán nào rẻ thôi"), để NULL hoặc mảng rỗng

5. Location (district) - RẤT QUAN TRỌNG:
   - CHỈ extract khi QUERY GỐC CỦA USER đề cập đến quận/huyện/địa điểm cụ thể (VD: "Q7", "Quận 1", "Thủ Đức", "Long Bình")
   - Nếu QUERY GỐC KHÔNG nói gì về location (VD: "quán nào rẻ thôi", "quán nướng"), TUYỆT ĐỐI để NULL, KHÔNG extract location từ QUERY ĐÃ ĐƯỢC TỐI ƯU (vì location đó có thể đến từ context)
   - KIỂM TRA KỸ: Nếu QUERY GỐC không có từ khóa về location, thì district phải là NULL

6. Price (min_price, max_price):
   - CHỈ extract khi query gốc đề cập đến giá cụ thể (VD: "dưới 100k", "100k-200k")
   - Nếu query gốc chỉ nói "rẻ", "giá tốt" -> CHỈ set rating_price_min, KHÔNG set min_price/max_price

Hãy trích xuất chính xác các filters và parameters từ QUERY GỐC. Đừng thêm filters từ context nếu user không yêu cầu.
"""
        
        system_prompt = [{"text": system_prompt_text}]

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
                    
                    # VALIDATION: Nếu original_query không có location keywords, loại bỏ district
                    if params.get("district") and not self._has_location_keywords(original_query):
                        logger.warning(f"[VALIDATION] Removed district '{params['district']}' because original_query '{original_query}' doesn't mention location")
                        params["district"] = None
                    
                    # VALIDATION: Nếu original_query không có category keywords, loại bỏ target_categories
                    if params.get("target_categories") and not self._has_category_keywords(original_query):
                        logger.warning(f"[VALIDATION] Removed target_categories '{params['target_categories']}' because original_query '{original_query}' doesn't mention category")
                        params["target_categories"] = []
                    
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

        # Sanitize query cho tsquery: loại bỏ ký tự đặc biệt, số, dấu câu
        # tsquery không hỗ trợ số, dấu phẩy, dấu gạch ngang, dấu hai chấm
        # Loại bỏ số, dấu câu đặc biệt, chỉ giữ chữ cái và khoảng trắng
        words = re.findall(r'[a-zA-ZÀ-ỹ]+', query_text)
        clean_query = " | ".join(words) if words else query_text.replace("!", "").replace("&", "").replace("|", " ").replace(":", " ").replace("-", " ").replace(",", " ").replace(".", " ")

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
        
        # Handle district có thể là array/JSON string
        if isinstance(district, list):
            # Nếu là array, lấy phần tử đầu tiên
            district = district[0] if district else None
        elif isinstance(district, str):
            # Nếu là JSON string như '["Quận 7", "Quận 3"]', parse nó
            if district.strip().startswith('[') and district.strip().endswith(']'):
                try:
                    import json
                    district_list = json.loads(district)
                    district = district_list[0] if district_list else None
                    logger.info(f"[DISTRICT] Parsed JSON array, using first district: {district}")
                except (json.JSONDecodeError, IndexError):
                    logger.warning(f"[DISTRICT] Failed to parse JSON array: {district}, using as-is")
        
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
        
        logger.info(f"[SEARCH] Starting search with query: '{query_text}' | Strategy: {strategy} | Min Score: {min_score}")
        import sys
        sys.stdout.flush()  # Force flush để đảm bảo log được ghi ngay
        
        # Log filters được áp dụng
        active_filters = []
        if params.get("district"):
            active_filters.append(f"district={params['district']}")
        if params.get("min_price") or params.get("max_price"):
            price_range = f"{params.get('min_price', 'N/A')}-{params.get('max_price', 'N/A')}"
            active_filters.append(f"price={price_range}")
        if params.get("is_open_now"):
            active_filters.append("is_open_now=True")
        if params.get("target_categories"):
            active_filters.append(f"categories={params['target_categories']}")
        if params.get("exclude_keywords"):
            active_filters.append(f"exclude_keywords={params['exclude_keywords']}")
        if params.get("exclude_districts"):
            active_filters.append(f"exclude_districts={params['exclude_districts']}")
        
        # Log rating filters
        rating_filters = []
        for field in ["rating_service", "rating_location", "rating_price", "rating_quality", "rating_ambiance", "rating_overall"]:
            min_key = f"{field}_min"
            max_key = f"{field}_max"
            if params.get(min_key) is not None or params.get(max_key) is not None:
                rating_filters.append(f"{field}={params.get(min_key, 'N/A')}-{params.get(max_key, 'N/A')}")
        if rating_filters:
            active_filters.append(f"ratings=[{', '.join(rating_filters)}]")
        
        # Log count filters
        count_filters = []
        for key in ["min_rating_count", "min_review_count", "min_favorite_count", "min_view_count"]:
            if params.get(key) is not None:
                count_filters.append(f"{key}={params[key]}")
        if count_filters:
            active_filters.append(f"counts=[{', '.join(count_filters)}]")
        
        if active_filters:
            logger.info(f"[SEARCH] Active filters: {', '.join(active_filters)}")
        else:
            logger.info(f"[SEARCH] No filters applied (semantic search only)")
        
        query_emb = self.get_embedding(query_text)
        if not query_emb: 
            logger.warning(f"[SEARCH] Failed to get embedding for query: '{query_text}'")
            return []

        # Build base query
        sql_base, sql_params = self._build_base_query(query_text, strategy, query_emb)
        logger.debug(f"[SEARCH] Base query built | Strategy: {strategy}")
        
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
                logger.info(f"[SEARCH] SQL Query executed | Found: {len(results)} items | Time: {duration:.2f}s | Top Score: {top_score:.4f}")
                
                if results:
                    logger.info(f"[SEARCH] Top 3 results: {[(r.name_vi, f'{r.final_score:.4f}') for r in results[:3]]}")
                else:
                    logger.warning(f"[SEARCH] No results found with min_score >= {min_score}")
                
                return results
        except Exception as e:
            logger.error(f"[SEARCH ERROR] Query failed: {e}")
            logger.error(f"[SEARCH ERROR] Query: {sql_base[:500]}...")
            logger.error(f"[SEARCH ERROR] Params keys: {list(sql_params.keys())}")
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
                # Convert to float nếu là string
                try:
                    if isinstance(original_val, str):
                        original_val = float(original_val)
                    elif not isinstance(original_val, (int, float)):
                        logger.warning(f"[RATING RELAX] Skipping {min_key}: invalid type {type(original_val)}")
                        continue
                    relaxed_val = max(1.0, float(original_val) - relax_by)  # Không được < 1.0
                    relaxed[min_key] = relaxed_val
                    logger.info(f"[RATING RELAX] {min_key}: {original_val} -> {relaxed_val}")
                except (ValueError, TypeError) as e:
                    logger.warning(f"[RATING RELAX] Failed to relax {min_key}: {e}, skipping")
                    continue
        
        return relaxed

    def search_pipeline(self, params):
        pipeline_start = datetime.now()
        logger.info(f"[SEARCH PIPELINE] Starting search pipeline with params: {params}")
        import sys
        sys.stdout.flush()  # Force flush để đảm bảo log được ghi ngay
        
        # 1. Strict
        logger.info(f"[SEARCH PIPELINE] Step 1: Strict search (all filters)")
        results = self.execute_db_search(params, min_score=0.2)
        if results:
            duration = (datetime.now() - pipeline_start).total_seconds()
            logger.info(f"[SEARCH PIPELINE] ✅ Step 1 SUCCESS | Found {len(results)} results | Total time: {duration:.2f}s")
            return results, "Đây là kết quả phù hợp nhất:"
        else:
            logger.info(f"[SEARCH PIPELINE] ❌ Step 1 FAILED | No results, trying fallback...")

        # 2. Relax Time/Price
        relax_params = params.copy()
        has_strict = any(k in params for k in ["min_price", "max_price", "is_open_now"])
        if has_strict:
            relax_params.pop("min_price", None)
            relax_params.pop("max_price", None)
            relax_params.pop("is_open_now", None)
            logger.info(f"[SEARCH PIPELINE] Step 2: Fallback - Drop Price/Time filters")
            logger.info(f"[SEARCH PIPELINE] Removed filters: min_price, max_price, is_open_now")
            results = self.execute_db_search(relax_params, min_score=0.2)
            if results:
                duration = (datetime.now() - pipeline_start).total_seconds()
                logger.info(f"[SEARCH PIPELINE] ✅ Step 2 SUCCESS | Found {len(results)} results | Total time: {duration:.2f}s")
                return results, "Không đúng giá/giờ yêu cầu, nhưng có quán này:"
            else:
                logger.info(f"[SEARCH PIPELINE] ❌ Step 2 FAILED | No results, trying next fallback...")

        # 3. Relax Rating Filters (giảm 1 điểm)
        has_rating_filters = any(k in params for k in [
            "rating_service_min", "rating_location_min", "rating_price_min",
            "rating_quality_min", "rating_ambiance_min", "rating_overall_min"
        ])
        if has_rating_filters:
            relaxed_rating_params = self._relax_rating_filters(params, relax_by=1.0)
            logger.info(f"[SEARCH PIPELINE] Step 3: Fallback - Relax Rating filters by 1.0")
            results = self.execute_db_search(relaxed_rating_params, min_score=0.2)
            if results:
                duration = (datetime.now() - pipeline_start).total_seconds()
                logger.info(f"[SEARCH PIPELINE] ✅ Step 3 SUCCESS | Found {len(results)} results | Total time: {duration:.2f}s")
                return results, "Không đúng rating yêu cầu, nhưng có quán gần đúng:"
            else:
                logger.info(f"[SEARCH PIPELINE] ❌ Step 3 FAILED | No results, trying next fallback...")

        # 4. Relax District
        if "district" in params:
            d_params = params.copy()
            original_district = d_params.pop("district")
            d_params.pop("is_open_now", None)
            logger.info(f"[SEARCH PIPELINE] Step 4: Fallback - Drop District filter")
            logger.info(f"[SEARCH PIPELINE] Removed district: {original_district}")
            results = self.execute_db_search(d_params, min_score=0.2)
            if results:
                duration = (datetime.now() - pipeline_start).total_seconds()
                logger.info(f"[SEARCH PIPELINE] ✅ Step 4 SUCCESS | Found {len(results)} results | Total time: {duration:.2f}s")
                return results, f"Quận {original_district} không có, nhưng chỗ khác có:"
            else:
                logger.info(f"[SEARCH PIPELINE] ❌ Step 4 FAILED | No results, trying final fallback...")

        # 5. Semantic Only
        logger.info(f"[SEARCH PIPELINE] Step 5: Final Fallback - Semantic search only (no filters)")
        semantic_params = {"search_text": params["search_text"], "search_strategy": "semantic"}
        results = self.execute_db_search(semantic_params, min_score=0.25)
        if results:
            duration = (datetime.now() - pipeline_start).total_seconds()
            logger.info(f"[SEARCH PIPELINE] ✅ Step 5 SUCCESS | Found {len(results)} results | Total time: {duration:.2f}s")
            return results, "Tìm theo vibe/ngữ nghĩa:"
        else:
            duration = (datetime.now() - pipeline_start).total_seconds()
            logger.warning(f"[SEARCH PIPELINE] ❌ ALL STEPS FAILED | No results found after all fallbacks | Total time: {duration:.2f}s")
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
    import sys
    try:
        logger.info(f"\n{'='*20} NEW REQUEST [Session: {payload.session_id}] {'='*20}")
        logger.info(f"[USER QUERY] {payload.query}")
        sys.stdout.flush()  # Force flush ngay từ đầu

        
        session_mgr = USER_SESSIONS.get(payload.session_id, [])
        if payload.is_new_topic: session_mgr = []
        logger.info(f"[SEARCH FLOW] Session history length: {len(session_mgr)} | is_new_topic: {payload.is_new_topic}")
        sys.stdout.flush()
        
        rag = RAGService(payload.session_id, session_mgr)
        logger.info(f"[SEARCH FLOW] RAGService initialized")
        sys.stdout.flush()

        # Query Rewriting: Tóm tắt context và rewrite query để tối ưu cho search
        logger.info(f"[SEARCH FLOW] Step 1: Summarizing context from session history")
        sys.stdout.flush()
        
        try:
            context_summary = rag._summarize_context(session_mgr, max_messages=10)
            logger.info(f"[SEARCH FLOW] Context summary: {context_summary[:100] if context_summary else 'None'}...")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[SEARCH FLOW ERROR] Context summarization failed: {e}")
            logger.error(traceback.format_exc())
            sys.stdout.flush()
            context_summary = ""
        
        logger.info(f"[SEARCH FLOW] Step 2: Rewriting query for search optimization")
        sys.stdout.flush()
        
        try:
            rewritten_query = rag._rewrite_query_for_search(payload.query, context_summary)
            logger.info(f"[SEARCH FLOW] Rewritten query: '{rewritten_query}'")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[SEARCH FLOW ERROR] Query rewrite failed: {e}")
            logger.error(traceback.format_exc())
            sys.stdout.flush()
            rewritten_query = payload.query  # Fallback to original
        
        logger.info(f"[SEARCH FLOW] Step 3: Parsing intent from rewritten query")
        sys.stdout.flush()
        
        try:
            # Pipeline - dùng rewritten query cho search engine, nhưng truyền original_query vào parse_intent
            # để chỉ extract filters từ query gốc của user, không phải từ context đã inject
            params = rag.parse_intent(rewritten_query, context_summary=context_summary, original_query=payload.query)
            logger.info(f"[SEARCH FLOW] Parsed intent: {params}")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[SEARCH FLOW ERROR] Intent parsing failed: {e}")
            logger.error(traceback.format_exc())
            sys.stdout.flush()
            # Fallback to basic params
            params = {"search_text": rewritten_query, "search_strategy": "semantic"}
            logger.warning(f"[SEARCH FLOW] Using fallback params: {params}")

        # Lấy mood ra (mặc định là neutral nếu không có)
        current_mood = params.get("mood", "neutral")
        logger.info(f"[SEARCH FLOW] User mood: {current_mood}")
        sys.stdout.flush()

        logger.info(f"[SEARCH FLOW] Step 4: Executing search pipeline")
        sys.stdout.flush()  # Force flush logs
        
        try:
            results, note = rag.search_pipeline(params)
            logger.info(f"[SEARCH FLOW] Search completed | Found {len(results)} results | Note: {note}")
            sys.stdout.flush()  # Force flush logs
        except Exception as e:
            logger.error(f"[SEARCH FLOW ERROR] Search pipeline failed: {e}")
            logger.error(traceback.format_exc())
            sys.stdout.flush()
            raise  # Re-raise để được catch ở outer try-catch
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