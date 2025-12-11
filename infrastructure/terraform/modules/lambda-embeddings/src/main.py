import os
import json
import boto3
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy import create_engine, text
from botocore.exceptions import ClientError

# ============================================
# CẤU HÌNH & LOGGING
# ============================================

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")
DB_HOST = os.environ.get("DB_HOST")
DB_NAME = os.environ.get("DB_NAME", "mapvibe")

# AWS Clients
secrets_client = boto3.client('secretsmanager', region_name=AWS_REGION)
bedrock_client = boto3.client(service_name='bedrock-runtime', region_name=AWS_REGION)

# Model config (giống lambda-rag)
MODEL_EMBED = "amazon.titan-embed-text-v2:0"

# ============================================
# DATABASE CONNECTION
# ============================================

def get_db_url():
    """Lấy database connection string từ Secrets Manager"""
    try:
        if not DB_SECRET_ARN:
            logger.warning("⚠️ Missing DB_SECRET_ARN env var")
            return None
            
        response = secrets_client.get_secret_value(SecretId=DB_SECRET_ARN)
        creds = json.loads(response['SecretString'])
        user = creds.get('username')
        password = creds.get('password')
        
        url = f"postgresql+pg8000://{user}:{password}@{DB_HOST}:5432/{DB_NAME}"
        return url
    except Exception as e:
        logger.error(f"❌ Error getting DB Secret: {str(e)}")
        return None

# Initialize DB engine with proper pool settings for Lambda
# Lambda processes batches of 5, so we need at least 5 connections
db_url = get_db_url()
engine = None
if db_url:
    try:
        engine = create_engine(
            db_url,
            pool_size=5,           # Match batch size (5 messages per batch)
            max_overflow=2,        # Allow 2 extra connections if needed
            pool_timeout=30,       # Wait up to 30s for a connection
            pool_recycle=3600,     # Recycle connections after 1 hour
        )
        logger.info("✅ Database Engine initialized with pool_size=5, max_overflow=2")
    except Exception as e:
        logger.error(f"❌ Engine Creation Failed: {str(e)}")
else:
    logger.error("❌ Could not initialize DB Engine (Missing URL)")

# ============================================
# EMBEDDING GENERATION
# ============================================

def get_embedding(text_input: str) -> Optional[List[float]]:
    """Tạo embedding vector từ text bằng Bedrock Titan"""
    if not text_input or not text_input.strip():
        return None
    
    try:
        body = json.dumps({
            "inputText": text_input,
            "dimensions": 1024,  # Phải khớp với DB schema: vector(1536)
            "normalize": True
        })
        
        response = bedrock_client.invoke_model(
            modelId=MODEL_EMBED,
            body=body
        )
        
        embedding_data = json.loads(response["body"].read())
        embedding = embedding_data.get("embedding")
        
        if embedding and len(embedding) == 1024:
            logger.info(f"✅ Generated embedding vector (dim={len(embedding)})")
            return embedding
        else:
            logger.error(f"❌ Invalid embedding dimension: {len(embedding) if embedding else 0}")
            return None
            
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"❌ Bedrock error ({error_code}): {str(e)}")
        return None
    except Exception as e:
        logger.error(f"❌ Embedding generation error: {str(e)}")
        return None

# ============================================
# DATABASE OPERATIONS
# ============================================

def get_restaurant_data(restaurant_id: str) -> Optional[Dict[str, Any]]:
    """Lấy dữ liệu nhà hàng từ DB để tạo embedding"""
    if not engine:
        logger.error("❌ Database engine not initialized")
        return None
    
    # Retry logic for connection issues
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with engine.connect() as conn:
                # Lấy thông tin cơ bản từ restaurants
                restaurant_result = conn.execute(
                    text("""
                        SELECT id, name_vi, slug, address, description, business_type,
                               cuisine_types, price_min, price_max, opening_hours,features
                        FROM restaurants
                        WHERE id = :restaurant_id
                    """),
                    {"restaurant_id": restaurant_id}
                ).fetchone()
                
                if not restaurant_result:
                    logger.warning(f"⚠️ Restaurant {restaurant_id} not found")
                    return None
                
                # Parse JSON columns nếu cần
                cuisine_types = restaurant_result[6]
                if isinstance(cuisine_types, str):
                    try:
                        cuisine_types = json.loads(cuisine_types)
                    except:
                        pass  # Giữ nguyên string nếu không parse được
                
                features = restaurant_result[10]
                if isinstance(features, str):
                    try:
                        features = json.loads(features)
                    except:
                        pass  # Giữ nguyên string nếu không parse được
                
                restaurant_data = {
                    'id': restaurant_result[0],
                    'name_vi': restaurant_result[1],
                    'slug': restaurant_result[2],
                    'address': restaurant_result[3],
                    'description': restaurant_result[4],
                    'business_type': restaurant_result[5],
                    'cuisine_types': cuisine_types,
                    'price_min': restaurant_result[7],
                    'price_max': restaurant_result[8],
                    'opening_hours': restaurant_result[9],
                    'features': features
                }
                
                # Lấy menu từ photos (OCR đã xử lý)
                menu_results = conn.execute(
                    text("""
                        SELECT ocr_structured
                        FROM photos
                        WHERE restaurant_id = :restaurant_id
                          AND photo_type = 'menu'
                          AND ocr_structured IS NOT NULL
                        ORDER BY processed_at DESC
                        LIMIT 1
                    """),
                    {"restaurant_id": restaurant_id}
                ).fetchall()
                
                menu_items = []
                if menu_results:
                    ocr_data = menu_results[0][0]
                    if isinstance(ocr_data, dict):
                        menu_items = ocr_data.get('items', [])
                
                restaurant_data['menu_items'] = menu_items
                return restaurant_data
                
        except Exception as e:
            error_msg = str(e)
            if "timeout" in error_msg.lower() or "connection" in error_msg.lower() or "pool" in error_msg.lower():
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2  # Exponential backoff: 2s, 4s, 6s
                    logger.warning(f"⚠️ Connection error (attempt {attempt + 1}/{max_retries}): {error_msg}")
                    logger.info(f"⏳ Retrying in {wait_time}s...")
                    import time
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"❌ Error querying restaurant data after {max_retries} attempts: {error_msg}")
                    return None
            else:
                logger.error(f"❌ Error querying restaurant data: {error_msg}")
                return None
    
    return None

def build_embedding_text(restaurant_data: Dict[str, Any]) -> str:
    """
    Ghép các thông tin nhà hàng thành 1 text lớn để embed
    Format: Tên - Địa chỉ - Mô tả - Loại hình - Món ăn - Giá - Giờ mở cửa
    """
    parts = []
    
    # Tên nhà hàng
    if restaurant_data.get('name_vi'):
        parts.append(restaurant_data['name_vi'])
    
    # Địa chỉ
    if restaurant_data.get('address'):
        parts.append(restaurant_data['address'])
    
    # Mô tả
    if restaurant_data.get('description'):
        parts.append(restaurant_data['description'])
    
    # Loại hình kinh doanh
    if restaurant_data.get('business_type'):
        parts.append(f"Loại hình: {restaurant_data['business_type']}")
    
    # Loại ẩm thực
    cuisine_types = restaurant_data.get('cuisine_types')
    if cuisine_types:
        if isinstance(cuisine_types, list):
            # Xử lý trường hợp list chứa dict hoặc string
            cuisine_names = []
            for item in cuisine_types:
                if isinstance(item, dict):
                    # Nếu là dict, thử lấy 'name', 'value', hoặc giá trị đầu tiên
                    name = item.get('name') or item.get('value') or item.get('label')
                    if name:
                        cuisine_names.append(str(name))
                    elif len(item) > 0:
                        # Lấy giá trị đầu tiên của dict
                        cuisine_names.append(str(list(item.values())[0]))
                elif isinstance(item, str):
                    cuisine_names.append(item)
                else:
                    cuisine_names.append(str(item))
            
            if cuisine_names:
                parts.append(f"Ẩm thực: {', '.join(cuisine_names)}")
        elif isinstance(cuisine_types, str):
            try:
                parsed = json.loads(cuisine_types)
                if isinstance(parsed, list):
                    # Xử lý tương tự như trên
                    cuisine_names = []
                    for item in parsed:
                        if isinstance(item, dict):
                            name = item.get('name') or item.get('value') or item.get('label')
                            if name:
                                cuisine_names.append(str(name))
                            elif len(item) > 0:
                                cuisine_names.append(str(list(item.values())[0]))
                        elif isinstance(item, str):
                            cuisine_names.append(item)
                        else:
                            cuisine_names.append(str(item))
                    
                    if cuisine_names:
                        parts.append(f"Ẩm thực: {', '.join(cuisine_names)}")
                    else:
                        parts.append(f"Ẩm thực: {cuisine_types}")
                else:
                    parts.append(f"Ẩm thực: {cuisine_types}")
            except:
                parts.append(f"Ẩm thực: {cuisine_types}")
    
    # Features
    if restaurant_data.get('features'):
        features = restaurant_data['features']
        if isinstance(features, list):
            # Xử lý trường hợp list chứa dict hoặc string
            feature_names = []
            for item in features:
                if isinstance(item, dict):
                    # Nếu là dict, thử lấy 'name', 'value', hoặc giá trị đầu tiên
                    name = item.get('name') or item.get('value') or item.get('label')
                    if name:
                        feature_names.append(str(name))
                    elif len(item) > 0:
                        feature_names.append(str(list(item.values())[0]))
                elif isinstance(item, str):
                    feature_names.append(item)
                else:
                    feature_names.append(str(item))
            
            if feature_names:
                parts.append(f"Tiện ích: {', '.join(feature_names)}")
        elif isinstance(features, str):
            parts.append(f"Tiện ích: {features}")
    
    # Menu items
    menu_items = restaurant_data.get('menu_items', [])
    if menu_items:
        menu_text = "Menu: "
        item_names = []
        for item in menu_items[:20]:  # Limit to 20 items
            name = item.get('name', '')
            price = item.get('price')
            if name:
                if price:
                    item_names.append(f"{name} ({price:,}đ)")
                else:
                    item_names.append(name)
        if item_names:
            menu_text += ", ".join(item_names)
            parts.append(menu_text)
    
    # Giá
    price_min = restaurant_data.get('price_min')
    price_max = restaurant_data.get('price_max')
    if price_min or price_max:
        if price_min and price_max:
            parts.append(f"Giá: {price_min:,}đ - {price_max:,}đ")
        elif price_min:
            parts.append(f"Giá từ: {price_min:,}đ")
        elif price_max:
            parts.append(f"Giá đến: {price_max:,}đ")
    
    # Giờ mở cửa
    if restaurant_data.get('opening_hours'):
        parts.append(f"Giờ mở cửa: {restaurant_data['opening_hours']}")
    
    return " | ".join(parts)

def update_restaurant_embedding(restaurant_id: str, embedding: List[float]):
    """
    Update embedding vector vào DB
    Đồng thời cập nhật search_vector (tsvector) cho full-text search
    """
    if not engine:
        logger.error("❌ Database engine not initialized")
        return False
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Sử dụng engine.begin() để đảm bảo transaction được commit đúng cách
            with engine.begin() as conn:
                # Lấy lại restaurant data để tạo search_vector
                restaurant_data = get_restaurant_data(restaurant_id)
                if not restaurant_data:
                    logger.error(f"❌ Cannot get restaurant data for {restaurant_id}, cannot update embedding")
                    return False
                
                # Tạo text cho search_vector (chỉ cần tên, mô tả, địa chỉ)
                search_parts = []
                if restaurant_data.get('name_vi'):
                    search_parts.append(restaurant_data['name_vi'])
                if restaurant_data.get('address'):
                    search_parts.append(restaurant_data['address'])
                if restaurant_data.get('description'):
                    search_parts.append(restaurant_data['description'])
                
                # Xử lý features
                features = restaurant_data.get('features')
                if features:
                    if isinstance(features, list):
                        feature_names = []
                        for item in features:
                            if isinstance(item, dict):
                                name = item.get('name') or item.get('value') or item.get('label')
                                if name:
                                    feature_names.append(str(name))
                                elif len(item) > 0:
                                    feature_names.append(str(list(item.values())[0]))
                            elif isinstance(item, str):
                                feature_names.append(item)
                            else:
                                feature_names.append(str(item))
                        if feature_names:
                            search_parts.append(', '.join(feature_names))
                    elif isinstance(features, str):
                        search_parts.append(features)
                
                if restaurant_data.get('business_type'):
                    search_parts.append(restaurant_data['business_type'])        
                
                # Xử lý cuisine_types
                cuisine_types = restaurant_data.get('cuisine_types')
                if cuisine_types:
                    if isinstance(cuisine_types, list):
                        cuisine_names = []
                        for item in cuisine_types:
                            if isinstance(item, dict):
                                name = item.get('name') or item.get('value') or item.get('label')
                                if name:
                                    cuisine_names.append(str(name))
                                elif len(item) > 0:
                                    cuisine_names.append(str(list(item.values())[0]))
                            elif isinstance(item, str):
                                cuisine_names.append(item)
                            else:
                                cuisine_names.append(str(item))
                        if cuisine_names:
                            search_parts.append(', '.join(cuisine_names))
                    elif isinstance(cuisine_types, str):
                        search_parts.append(cuisine_types)
                
                menu_items = restaurant_data.get('menu_items', [])
                if menu_items:
                    search_parts.append(', '.join([item.get('name', '') for item in menu_items[:10]]))

                search_text = " ".join(search_parts)
                
                # Convert embedding list thành PostgreSQL vector format
                embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                
                # Update cả embedding và search_vector
                # Sử dụng engine.begin() nên transaction sẽ tự động commit khi exit context
                result = conn.execute(
                    text("""
                        UPDATE restaurants
                        SET embedding = CAST(:embedding AS vector),
                            search_vector = to_tsvector('simple', unaccent(:search_text)),
                            updated_at = NOW()
                        WHERE id = :restaurant_id
                    """),
                    {
                        "restaurant_id": restaurant_id,
                        "embedding": embedding_str,
                        "search_text": search_text
                    }
                )
                
                # Kiểm tra xem có row nào được update không
                rows_updated = result.rowcount
                if rows_updated == 0:
                    logger.warning(f"⚠️ No rows updated for restaurant {restaurant_id} - restaurant may not exist")
                    return False
                
                # engine.begin() tự động commit khi exit context successfully
                logger.info(f"✅ Updated embedding for restaurant {restaurant_id} (rows_updated={rows_updated})")
                return True
                
        except Exception as e:
            error_msg = str(e)
            if "timeout" in error_msg.lower() or "connection" in error_msg.lower() or "pool" in error_msg.lower():
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    logger.warning(f"⚠️ Connection error (attempt {attempt + 1}/{max_retries}): {error_msg}")
                    logger.info(f"⏳ Retrying in {wait_time}s...")
                    import time
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"❌ Error updating restaurant embedding after {max_retries} attempts: {error_msg}")
                    return False
            else:
                logger.error(f"❌ Error updating restaurant embedding: {error_msg}")
                import traceback
                logger.error(traceback.format_exc())
                return False
    
    return False

# ============================================
# LAMBDA HANDLER
# ============================================

def process_embedding_job(restaurant_id: str) -> Dict[str, Any]:
    """Xử lý 1 job tạo embedding cho 1 nhà hàng"""
    logger.info(f"🔄 Processing embedding job for restaurant: {restaurant_id}")
    
    try:
        # 1. Lấy dữ liệu nhà hàng
        restaurant_data = get_restaurant_data(restaurant_id)
        if not restaurant_data:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': f'Restaurant {restaurant_id} not found'})
            }
        
        # 2. Build text để embed
        embedding_text = build_embedding_text(restaurant_data)
        logger.info(f"📝 Embedding text length: {len(embedding_text)} chars")
        
        # 3. Tạo embedding vector
        embedding = get_embedding(embedding_text)
        if not embedding:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to generate embedding'})
            }
        
        # 4. Update vào DB
        success = update_restaurant_embedding(restaurant_id, embedding)
        if not success:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to update database'})
            }
        
        logger.info(f"✅ Successfully processed embedding for restaurant {restaurant_id}")
        return {
            'statusCode': 200,
            'body': json.dumps({
                'restaurant_id': restaurant_id,
                'message': 'Embedding updated successfully',
                'embedding_dim': len(embedding)
            })
        }
        
    except Exception as e:
        logger.error(f"❌ Error processing embedding job: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler
    Nhận SQS messages với format: { "restaurant_id": "..." }
    """
    logger.info(f"🚀 Lambda Embeddings triggered. Event keys: {list(event.keys())}")
    
    results = []
    
    try:
        # SQS event (batch processing)
        if 'Records' in event:
            for record in event['Records']:
                if record.get('eventSource') == 'aws:sqs':
                    try:
                        # Parse message body
                        body = json.loads(record.get('body', '{}'))
                        restaurant_id = body.get('restaurant_id')
                        
                        if not restaurant_id:
                            logger.warning(f"⚠️ Missing restaurant_id in message: {record.get('body')}")
                            continue
                        
                        # Process job
                        result = process_embedding_job(restaurant_id)
                        results.append(result)
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"❌ Invalid JSON in SQS message: {str(e)}")
                    except Exception as e:
                        logger.error(f"❌ Error processing record: {str(e)}")
        
        # Direct invocation (test)
        elif 'restaurant_id' in event:
            restaurant_id = event['restaurant_id']
            result = process_embedding_job(restaurant_id)
            return result
        
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid event format'})
            }
        
        # Nếu có kết quả, trả về kết quả đầu tiên
        if results:
            return results[0]
        else:
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'No valid jobs processed'})
            }
            
    except Exception as e:
        logger.error(f"❌ Lambda handler error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
