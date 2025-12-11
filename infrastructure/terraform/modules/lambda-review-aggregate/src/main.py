import json
import os
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

import boto3
from botocore.exceptions import ClientError
from sqlalchemy import create_engine, text

from jwt_utils import require_auth

# Configure logging for Lambda
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    force=True  # Force reconfiguration
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Also use print for critical messages (always visible in CloudWatch)
def log_print(message: str, level: str = "INFO"):
    """Print message that will always appear in CloudWatch"""
    print(f"[{level}] {message}")
    if level == "ERROR":
        logger.error(message)
    elif level == "WARNING":
        logger.warning(message)
    else:
        logger.info(message)

AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")
DB_HOST = os.environ.get("DB_HOST")
DB_NAME = os.environ.get("DB_NAME", "mapvibe")

secrets_client = boto3.client("secretsmanager", region_name=AWS_REGION)
bedrock_client = boto3.client(service_name="bedrock-runtime", region_name=AWS_REGION)

MODEL_CHAT = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"


def get_db_url() -> Optional[str]:
    try:
        if not DB_SECRET_ARN:
            logger.error("Missing DB_SECRET_ARN")
            return None

        response = secrets_client.get_secret_value(SecretId=DB_SECRET_ARN)
        creds = json.loads(response["SecretString"])
        user = creds.get("username")
        password = creds.get("password")
        return f"postgresql+pg8000://{user}:{password}@{DB_HOST}:5432/{DB_NAME}"
    except Exception as e:
        logger.error(f"Error getting DB secret: {e}")
        return None


db_url = get_db_url()
engine = create_engine(db_url, pool_size=1, max_overflow=0) if db_url else None


def call_bedrock_retry(messages: List[Dict[str, Any]], system_prompt: str = None, max_retries: int = 3):
    for i in range(max_retries):
        try:
            params = {
                "modelId": MODEL_CHAT,
                "messages": messages,
                "inferenceConfig": {"temperature": 0.2},
            }
            if system_prompt:
                params["system"] = [{"text": system_prompt}]
            
            response = bedrock_client.converse(**params)
            usage = response.get("usage", {})
            logger.info(
                f"[BEDROCK] In: {usage.get('inputTokens', 0)} tok | Out: {usage.get('outputTokens', 0)} tok"
            )
            return response
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "ThrottlingException" and i < max_retries - 1:
                continue
            raise


def normalize_text(text_input: Optional[str], limit: int = 800) -> str:
    if not text_input:
        return ""
    cleaned = " ".join(text_input.split())
    return cleaned[:limit]


def check_location_status(location_address_id: str) -> Dict[str, Any]:
    """Check location_address status, restaurant_id and existing data (phone, opening_hours, price)"""
    if not engine:
        raise Exception("Database engine not initialized")

    with engine.connect() as conn:
        location = conn.execute(
            text(
                """
                SELECT status, restaurant_id, phone, opening_hours, price_min, price_max
                FROM location_addresses
                WHERE id = :loc
                """
            ),
            {"loc": location_address_id},
        ).fetchone()

        if not location:
            raise ValueError(f"Location address {location_address_id} not found")

        return {
            "status": location.status,
            "restaurant_id": location.restaurant_id,
            "phone": location.phone,
            "opening_hours": location.opening_hours,
            "price_min": location.price_min,
            "price_max": location.price_max,
        }


def fetch_pending_reviews_and_comments(location_address_id: str):
    """Fetch reviews and comments for pending location (from review_posts with published status - vừa đăng chưa qua kiểm duyệt)"""
    if not engine:
        raise Exception("Database engine not initialized")

    with engine.connect() as conn:
        # Lấy reviews - bỏ điều kiện upvote_count > 0 để lấy cả reviews chưa có upvote
        # Reviews vừa đăng lên (chưa qua kiểm duyệt) có status = 'published'
        reviews = conn.execute(
            text(
                """
                SELECT id, text, features, upvote_count, created_at
                FROM review_posts
                WHERE location_address_id = :loc
                  AND status = 'published'
                ORDER BY upvote_count DESC NULLS LAST, created_at DESC
                LIMIT 10
                """
            ),
            {"loc": location_address_id},
        ).fetchall()
        
        logger.info(f"📊 Found {len(reviews)} published reviews for location {location_address_id}")

        # Lấy comments - bỏ điều kiện like_count > 0 để lấy cả comments chưa có like
        # Comments vừa đăng lên (chưa qua kiểm duyệt) có status = 'published'
        comments = conn.execute(
            text(
                """
                SELECT c.id, c.text, c.like_count, c.created_at
                FROM comments c
                JOIN review_posts rp ON c.review_post_id = rp.id
                WHERE rp.location_address_id = :loc
                  AND rp.status = 'published'
                  AND c.status = 'published'
                ORDER BY c.like_count DESC NULLS LAST, c.created_at DESC
                LIMIT 10
                """
            ),
            {"loc": location_address_id},
        ).fetchall()
        
        logger.info(f"📊 Found {len(comments)} published comments for location {location_address_id}")

    def serialize_review(row):
        return {
            "id": row.id,
            "text": normalize_text(row.text),
            "features": row.features if row.features is not None else [],
            "upvote_count": int(row.upvote_count or 0),
            "created_at": row.created_at.isoformat() if isinstance(row.created_at, datetime) else str(row.created_at),
        }

    def serialize_comment(row):
        return {
            "id": row.id,
            "text": normalize_text(row.text, limit=400),
            "like_count": int(row.like_count or 0),
            "created_at": row.created_at.isoformat() if isinstance(row.created_at, datetime) else str(row.created_at),
        }

    return [serialize_review(r) for r in reviews], [serialize_comment(c) for c in comments]


def fetch_approved_reviews_and_comments(restaurant_id: str):
    """Fetch reviews and comments for approved location (from restaurant_reviews)"""
    if not engine:
        raise Exception("Database engine not initialized")

    with engine.connect() as conn:
        # Lấy reviews - bỏ điều kiện upvote_count > 0 để lấy cả reviews chưa có upvote
        reviews = conn.execute(
            text(
                """
                SELECT id, text, upvote_count, created_at
                FROM restaurant_reviews
                WHERE restaurant_id = :rest_id
                ORDER BY upvote_count DESC NULLS LAST, created_at DESC
                LIMIT 10
                """
            ),
            {"rest_id": restaurant_id},
        ).fetchall()
        
        logger.info(f"📊 Found {len(reviews)} approved reviews for restaurant {restaurant_id}")

        # Lấy comments - bỏ điều kiện like_count > 0 để lấy cả comments chưa có like
        comments = conn.execute(
            text(
                """
                SELECT c.id, c.text, c.like_count, c.created_at
                FROM comments c
                JOIN restaurant_reviews rr ON c.restaurant_review_id = rr.id
                WHERE rr.restaurant_id = :rest_id
                  AND c.status = 'published'
                ORDER BY c.like_count DESC NULLS LAST, c.created_at DESC
                LIMIT 10
                """
            ),
            {"rest_id": restaurant_id},
        ).fetchall()
        
        logger.info(f"📊 Found {len(comments)} approved comments for restaurant {restaurant_id}")

    def serialize_review(row):
        return {
            "id": row.id,
            "text": normalize_text(row.text),
            "features": [],  # restaurant_reviews không có features, LLM sẽ suy luận
            "upvote_count": int(row.upvote_count or 0),
            "created_at": row.created_at.isoformat() if isinstance(row.created_at, datetime) else str(row.created_at),
        }

    def serialize_comment(row):
        return {
            "id": row.id,
            "text": normalize_text(row.text, limit=400),
            "like_count": int(row.like_count or 0),
            "created_at": row.created_at.isoformat() if isinstance(row.created_at, datetime) else str(row.created_at),
        }

    return [serialize_review(r) for r in reviews], [serialize_comment(c) for c in comments]


def normalize_cuisine_types(cuisine_types: Any) -> List[Dict[str, str]]:
    """
    Normalize cuisine_types thành array of objects với format:
    [{"name": "...", "description": "..."}, ...]
    """
    normalized = []
    
    if cuisine_types is None:
        return []
    
    # Nếu là string, thử parse JSON
    if isinstance(cuisine_types, str):
        try:
            parsed = json.loads(cuisine_types)
            if isinstance(parsed, list):
                cuisine_types = parsed
            else:
                return []
        except:
            return []
    
    # Xử lý list
    if isinstance(cuisine_types, list):
        for item in cuisine_types:
            if isinstance(item, dict):
                # Object format: {"name": "...", "description": "..."}
                name = item.get("name", "").strip() if item.get("name") else ""
                description = item.get("description", "").strip() if item.get("description") else ""
                
                if name:  # Chỉ thêm nếu có name
                    normalized.append({
                        "name": name,
                        "description": description  # Có thể rỗng
                    })
            elif isinstance(item, str) and item.strip():
                # String format - convert thành object
                normalized.append({
                    "name": item.strip(),
                    "description": ""
                })
    
    return normalized


def build_prompt(
    reviews: List[Dict[str, Any]], comments: List[Dict[str, Any]], source_type: str
) -> List[Dict[str, Any]]:
    # Build reviews string with features if available
    reviews_lines = []
    for r in reviews:
        review_line = f"- Review {r['id']} (upvotes {r['upvote_count']}): {r['text']}"
        if r.get("features"):
            review_line += f" | features: {', '.join(r['features'])}"
        reviews_lines.append(review_line)
    reviews_str = "\n".join(reviews_lines) if reviews_lines else "None"

    comments_str = "\n".join(
        [f"- Comment {c['id']} (likes {c['like_count']}): {c['text']}" for c in comments]
    ) or "None"

    system_prompt = (
        "Bạn là hệ thống tổng hợp dữ liệu nhà hàng. "
        "Dùng thông tin dưới đây để suy luận các trường. "
        "Chỉ trả về JSON với các thuộc tính: "
        "name_vi, slug, address, ward, phone, website, geo_lat, geo_lng, "
        "business_type, cuisine_types, price_min, price_max, opening_hours, "
        "description, features. "
        "Nếu thiếu thông tin, trả về null cho field đó (features và cuisine_types: mảng, có thể rỗng). "
        "price_min/price_max là integer. opening_hours phải ở format 'HH:MM - HH:MM' hoặc null. "
        "Không tự bịa địa chỉ hay toạ độ nếu không có căn cứ. "
        "Với features: nếu review không có sẵn features, hãy suy luận từ nội dung text của reviews và comments.\n\n"
        "QUAN TRỌNG về cuisine_types (mảng JSON array của objects):\n"
        "- cuisine_types phải là mảng các objects, mỗi object có 2 trường bắt buộc: 'name' và 'description'\n"
        "- Format ví dụ CHÍNH XÁC:\n"
        "  [\n"
        "    {\"name\": \"BUFFET LẨU BĂNG CHUYỀN\", \"description\": \"Bao gồm các loại hải sản, thịt, rau củ và nấm.\"},\n"
        "    {\"name\": \"LẨU ĐA DẠNG NƯỚC DÙNG\", \"description\": \"Các lựa chọn nước lẩu như lẩu thảo mộc, lẩu kim chi, lẩu miso và nhiều loại khác.\"},\n"
        "    {\"name\": \"CHẾ BIẾN THEO YÊU CẦU\", \"description\": \"Thực khách có thể tự tay chế biến món ăn theo sở thích cá nhân.\"},\n"
        "    {\"name\": \"ẨM THỰC NHẬT BẢN\", \"description\": \"Không chỉ có lẩu, nhà hàng còn phục vụ nhiều món ăn theo phong cách Nhật Bản.\"},\n"
        "    {\"name\": \"NƯỚC CHẤM ĐA DẠNG\", \"description\": \"Nhiều loại nước chấm phong phú để khách tự pha chế.\"}\n"
        "  ]\n"
        "- Hãy trích xuất từ reviews/comments:\n"
        "  + name: Tên loại hình ẩm thực (3-6 từ, viết HOA, VD: \"BUFFET LẨU BĂNG CHUYỀN\")\n"
        "  + description: Mô tả chi tiết về loại hình đó (1-2 câu, giải thích rõ ràng từ thông tin trong reviews)\n"
        "- Mỗi object PHẢI có cả 'name' và 'description', không được thiếu.\n"
        "- name viết HOA, ngắn gọn (3-6 từ).\n"
        "- description là 1-2 câu mô tả chi tiết, trích xuất từ reviews/comments.\n"
        "- Nếu không tìm thấy thông tin cụ thể, trả về mảng rỗng [].\n"
        "- Không lặp lại thông tin đã có trong business_type.\n"
        "- Ưu tiên các thông tin được nhắc đến nhiều lần trong reviews/comments."
    )

    status_text = "published" if source_type == "pending" else "approved"
    user_prompt = f"""Dữ liệu review (top 10 upvote, status {status_text}):
{reviews_str}

Top comment (top 10 upvote, status {status_text}):
{comments_str}

Hãy tổng hợp và trả JSON."""

    messages = [{"role": "user", "content": [{"text": user_prompt}]}]
    return messages, system_prompt


def aggregate(location_address_id: str):
    log_print(f"📍 Checking location status for: {location_address_id}")
    # Check location status and restaurant_id + existing data
    location_info = check_location_status(location_address_id)
    status = location_info["status"]
    restaurant_id = location_info["restaurant_id"]
    existing_phone = location_info.get("phone")
    existing_opening_hours = location_info.get("opening_hours")
    existing_price_min = location_info.get("price_min")
    existing_price_max = location_info.get("price_max")
    log_print(f"📍 Location status: {status}, restaurant_id: {restaurant_id}")
    log_print(f"📍 Existing data - phone: {existing_phone}, opening_hours: {existing_opening_hours}, price: {existing_price_min}-{existing_price_max}")

    # Determine source type and fetch data accordingly
    if status == "approved" and restaurant_id:
        # Approved location: use restaurant_reviews
        source_type = "approved"
        reviews, comments = fetch_approved_reviews_and_comments(restaurant_id)
        logger.info(f"Processing approved location with restaurant_id: {restaurant_id}")
    elif status == "pending":
        # Pending location: use review_posts
        source_type = "pending"
        reviews, comments = fetch_pending_reviews_and_comments(location_address_id)
        logger.info(f"Processing pending location: {location_address_id}")
    else:
        raise ValueError(
            f"Invalid location status: {status}. Expected 'pending' or 'approved' with restaurant_id"
        )

    # Log warning nếu không có reviews
    if not reviews and not comments:
        logger.warning(f"⚠️ No reviews or comments found for location {location_address_id} (status: {status})")
    elif not reviews:
        logger.warning(f"⚠️ No reviews found, but found {len(comments)} comments")
    elif not comments:
        logger.warning(f"⚠️ No comments found, but found {len(reviews)} reviews")

    messages, system_prompt = build_prompt(reviews, comments, source_type)
    log_print(f"🤖 Calling Bedrock with {len(reviews)} reviews and {len(comments)} comments")
    
    try:
        response = call_bedrock_retry(messages, system_prompt)
        if not response:
            raise Exception("Bedrock returned empty response")
        
        log_print("✅ Bedrock response received")
        
        text_blocks = response["output"]["message"]["content"]
        output_text = ""
        for block in text_blocks:
            if "text" in block:
                output_text += block["text"]
        
        log_print(f"📝 Bedrock output length: {len(output_text)} characters")
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        log_print(f"❌ Bedrock error: {e}", "ERROR")
        log_print(f"Traceback: {error_trace}", "ERROR")
        raise Exception(f"Failed to call Bedrock: {str(e)}")

    try:
        payload = json.loads(output_text)
        log_print("✅ Successfully parsed JSON from Bedrock output")
        
        # Validate và normalize cuisine_types thành array of objects
        if "cuisine_types" in payload:
            payload["cuisine_types"] = normalize_cuisine_types(payload["cuisine_types"])
            logger.info(f"✅ Normalized cuisine_types: {len(payload['cuisine_types'])} items")
            if payload["cuisine_types"]:
                logger.info(f"   Sample: {payload['cuisine_types'][0]}")
        else:
            payload["cuisine_types"] = []
            logger.info("⚠️ cuisine_types not found in payload, setting to empty array")
            
    except json.JSONDecodeError as e:
        logger.warning(f"⚠️ LLM output is not valid JSON: {e}")
        logger.warning(f"⚠️ Raw output (first 500 chars): {output_text[:500]}")
        payload = {"raw": output_text, "cuisine_types": []}

    # Merge existing location data with AI results (existing data takes priority)
    # These fields come from location_addresses table, not from AI
    if existing_phone:
        payload["phone"] = existing_phone
    if existing_opening_hours:
        # opening_hours might be JSON object, convert to string if needed
        if isinstance(existing_opening_hours, dict):
            payload["opening_hours"] = json.dumps(existing_opening_hours)
        else:
            payload["opening_hours"] = existing_opening_hours
    if existing_price_min is not None:
        payload["price_min"] = existing_price_min
    if existing_price_max is not None:
        payload["price_max"] = existing_price_max
    
    log_print(f"📦 Final payload - phone: {payload.get('phone')}, opening_hours: {payload.get('opening_hours')}, price: {payload.get('price_min')}-{payload.get('price_max')}")

    return {
        "location_address_id": location_address_id,
        "restaurant_id": restaurant_id if source_type == "approved" else None,
        "source_type": source_type,
        "reviews_used": [r["id"] for r in reviews],
        "comments_used": [c["id"] for c in comments],
        "result": payload,
    }


# Note: CORS is handled by Lambda Function URL config in Terraform
# Only Content-Type header needed here
RESPONSE_HEADERS = {
    "Content-Type": "application/json",
}


def lambda_handler(event, context):
    # Log immediately - before any try-catch
    log_print("=" * 50)
    log_print("🚀 Lambda function started")
    log_print(f"📥 Event received: {type(event)}")
    
    # Handle CORS preflight request
    http_method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method", "")
    if http_method == "OPTIONS":
        log_print("✅ CORS preflight request - returning 200")
        return {
            "statusCode": 200,
            "headers": RESPONSE_HEADERS,
            "body": "",
        }
    
    try:
        # Log event details (safe version)
        event_summary = {
            "httpMethod": event.get("httpMethod"),
            "path": event.get("path"),
            "pathParameters": event.get("pathParameters"),
            "queryStringParameters": event.get("queryStringParameters"),
            "headers": {k: v for k, v in (event.get("headers") or {}).items() if k.lower() != "authorization"},
            "body": event.get("body")[:200] + "..." if event.get("body") and len(event.get("body", "")) > 200 else event.get("body"),
        }
        log_print(f"📋 Event summary: {json.dumps(event_summary, default=str)}")
        
        # JWT Authentication check
        log_print("🔐 Checking authentication...")
        is_authenticated, user_id, error_response = require_auth(event)
        if not is_authenticated:
            log_print("❌ Authentication failed", "ERROR")
            return error_response
        
        log_print(f"✅ Authenticated user: {user_id}")
        
        # Parse body
        log_print("📝 Parsing request body...")
        try:
            if event.get("body"):
                body = json.loads(event["body"])
            else:
                body = {}
            log_print(f"📋 Request body: {json.dumps(body, default=str)}")
        except json.JSONDecodeError as e:
            log_print(f"❌ Failed to parse request body: {e}", "ERROR")
            return {
                "statusCode": 400,
                "headers": RESPONSE_HEADERS,
                "body": json.dumps({"error": "Invalid JSON in request body"}),
            }
        
        location_address_id = body.get("location_address_id") or (event.get("queryStringParameters") or {}).get(
            "location_address_id"
        )
        if not location_address_id:
            log_print("❌ Missing location_address_id", "ERROR")
            return {
                "statusCode": 400,
                "headers": RESPONSE_HEADERS,
                "body": json.dumps({"error": "location_address_id is required"}),
            }

        log_print(f"🔄 Starting aggregation for location: {location_address_id}")
        result = aggregate(location_address_id)
        log_print(f"✅ Aggregation completed successfully")
        
        # Log result before returning
        result_json = json.dumps(result)
        log_print(f"📤 Returning result (length: {len(result_json)} chars)")
        log_print(f"📤 Result preview: {result_json[:200]}...")
        
        response = {
            "statusCode": 200,
            "headers": RESPONSE_HEADERS,
            "body": json.dumps(result),
        }
    except ValueError as e:
        import traceback
        error_trace = traceback.format_exc()
        log_print(f"❌ ValueError: {e}", "ERROR")
        log_print(f"Traceback: {error_trace}", "ERROR")
        return {
            "statusCode": 400,
            "headers": RESPONSE_HEADERS,
            "body": json.dumps({"error": str(e)}),
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        log_print(f"❌ Unexpected error: {e}", "ERROR")
        log_print(f"Traceback: {error_trace}", "ERROR")
        return {
            "statusCode": 500,
            "headers": RESPONSE_HEADERS,
            "body": json.dumps({"error": str(e), "message": "An unexpected error occurred"}),
        }
    finally:
        log_print("🏁 Lambda function finished")
        log_print("=" * 50)
