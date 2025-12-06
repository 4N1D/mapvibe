import os
import json
import boto3
import logging
import re
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
PHOTOS_BUCKET = os.environ.get("PHOTOS_BUCKET")

# AWS Clients
secrets_client = boto3.client('secretsmanager', region_name=AWS_REGION)
textract_client = boto3.client('textract', region_name=AWS_REGION)
s3_client = boto3.client('s3', region_name=AWS_REGION)

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

# Initialize DB engine
db_url = get_db_url()
engine = None
if db_url:
    try:
        engine = create_engine(db_url, pool_size=1, max_overflow=0)
        logger.info("✅ Database Engine initialized.")
    except Exception as e:
        logger.error(f"❌ Engine Creation Failed: {str(e)}")
else:
    logger.error("❌ Could not initialize DB Engine (Missing URL)")

# ============================================
# TEXTract OCR Processing
# ============================================

def extract_text_from_textract(response: Dict) -> str:
    """Trích xuất toàn bộ text từ Textract response"""
    text_lines = []
    blocks = response.get('Blocks', [])
    
    # Tìm các block có BlockType = 'LINE'
    line_blocks = [block for block in blocks if block.get('BlockType') == 'LINE']
    
    # Sắp xếp theo geometry để giữ thứ tự
    line_blocks.sort(key=lambda b: (
        b.get('Geometry', {}).get('BoundingBox', {}).get('Top', 0),
        b.get('Geometry', {}).get('BoundingBox', {}).get('Left', 0)
    ))
    
    for block in line_blocks:
        text = block.get('Text', '').strip()
        if text:
            text_lines.append(text)
    
    return '\n'.join(text_lines)

def parse_menu_items(ocr_text: str) -> List[Dict[str, Any]]:
    """
    Parse OCR text thành danh sách món ăn với giá
    Format: Tên món - Giá (VD: "Phở Bò - 45,000đ")
    """
    items = []
    lines = ocr_text.split('\n')
    
    # Pattern để match: Tên món - Giá hoặc Tên món Giá
    price_pattern = r'([\d,\.]+)\s*(?:đ|vnđ|VND|k|K)?'
    
    current_item = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Tìm giá trong dòng
        price_match = re.search(price_pattern, line)
        
        if price_match:
            price_str = price_match.group(1).replace(',', '').replace('.', '')
            try:
                price = int(price_str)
                # Nếu có 'k' hoặc 'K' thì nhân 1000
                if 'k' in line.lower() and price < 1000:
                    price = price * 1000
                
                # Lấy tên món (phần trước giá)
                item_name = line[:price_match.start()].strip()
                # Loại bỏ dấu gạch ngang, dấu chấm
                item_name = re.sub(r'[-–—•]\s*$', '', item_name).strip()
                
                if item_name:
                    items.append({
                        "name": item_name,
                        "price": price,
                        "confidence": 0.9  # Textract đã detect được nên confidence cao
                    })
            except ValueError:
                logger.warning(f"⚠️ Could not parse price from: {line}")
                # Nếu không parse được giá, vẫn lưu text làm tên món
                if current_item:
                    items.append({"name": line, "price": None, "confidence": 0.7})
        
        else:
            # Dòng không có giá, có thể là tên món đơn giản hoặc mô tả
            if len(line) > 3 and not line.isdigit():
                # Nếu dòng trước đó đã có item, có thể đây là mô tả
                # Nếu không, tạo item mới không có giá
                if not items or items[-1].get('price') is not None:
                    items.append({"name": line, "price": None, "confidence": 0.6})
    
    return items

def ocr_image_from_s3(bucket: str, key: str) -> Dict[str, Any]:
    """
    Gọi Textract để OCR ảnh từ S3
    Trả về: { 'full_text': str, 'items': List[Dict] }
    """
    try:
        logger.info(f"🔍 Starting Textract OCR for s3://{bucket}/{key}")
        
        # Gọi Textract AnalyzeDocument
        response = textract_client.analyze_document(
            Document={
                'S3Object': {
                    'Bucket': bucket,
                    'Name': key
                }
            },
            FeatureTypes=['TABLES', 'FORMS']  # Hỗ trợ table (menu thường là table)
        )
        
        # Trích xuất text
        full_text = extract_text_from_textract(response)
        logger.info(f"✅ OCR completed. Extracted {len(full_text)} characters")
        
        # Parse thành menu items
        menu_items = parse_menu_items(full_text)
        logger.info(f"📋 Parsed {len(menu_items)} menu items")
        
        return {
            'full_text': full_text,
            'items': menu_items,
            'raw_response': response  # Giữ lại để debug nếu cần
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"❌ Textract error ({error_code}): {str(e)}")
        raise
    except Exception as e:
        logger.error(f"❌ OCR processing error: {str(e)}")
        raise

# ============================================
# DATABASE OPERATIONS
# ============================================

def get_photo_from_db(photo_id: str) -> Optional[Dict[str, Any]]:
    """Lấy thông tin photo từ DB theo photo_id"""
    if not engine:
        logger.error("❌ Database engine not initialized")
        return None
    
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT id, restaurant_id, photo_type, s3_url, 
                           ocr_text, ocr_structured, processed_at
                    FROM photos
                    WHERE id = :photo_id
                """),
                {"photo_id": photo_id}
            ).fetchone()
            
            if result:
                return {
                    'id': result[0],
                    'restaurant_id': result[1],
                    'photo_type': result[2],
                    's3_url': result[3],
                    'ocr_text': result[4],
                    'ocr_structured': result[5],
                    'processed_at': result[6]
                }
            return None
    except Exception as e:
        logger.error(f"❌ Error querying photo from DB: {str(e)}")
        return None

def get_photo_from_s3_url(s3_url: str) -> Optional[Dict[str, Any]]:
    """Lấy thông tin photo từ DB theo s3_url"""
    if not engine:
        return None
    
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT id, restaurant_id, photo_type, s3_url
                    FROM photos
                    WHERE s3_url = :s3_url AND photo_type = 'menu'
                    LIMIT 1
                """),
                {"s3_url": s3_url}
            ).fetchone()
            
            if result:
                return {
                    'id': result[0],
                    'restaurant_id': result[1],
                    'photo_type': result[2],
                    's3_url': result[3]
                }
            return None
    except Exception as e:
        logger.error(f"❌ Error querying photo by S3 URL: {str(e)}")
        return None

def update_photo_ocr(photo_id: str, ocr_text: str, ocr_structured: Dict[str, Any]):
    """Update OCR kết quả vào DB"""
    if not engine:
        logger.error("❌ Database engine not initialized")
        return False
    
    try:
        with engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE photos
                    SET ocr_text = :ocr_text,
                        ocr_structured = :ocr_structured::jsonb,
                        processed_at = NOW()
                    WHERE id = :photo_id
                """),
                {
                    "photo_id": photo_id,
                    "ocr_text": ocr_text,
                    "ocr_structured": json.dumps(ocr_structured)
                }
            )
            conn.commit()
            logger.info(f"✅ Updated OCR results for photo {photo_id}")
            return True
    except Exception as e:
        logger.error(f"❌ Error updating photo OCR: {str(e)}")
        return False

# ============================================
# LAMBDA HANDLERS
# ============================================

def extract_s3_key_from_url(s3_url: str) -> Optional[str]:
    """Trích xuất bucket và key từ S3 URL"""
    # Format: https://bucket.s3.region.amazonaws.com/key
    # hoặc: s3://bucket/key
    if s3_url.startswith('s3://'):
        return s3_url[5:]  # Bỏ 's3://'
    elif 's3' in s3_url:
        # Parse từ https URL
        parts = s3_url.split('/')
        if len(parts) >= 4:
            # Tìm phần chứa bucket name
            bucket_start = next((i for i, p in enumerate(parts) if 's3' in p), None)
            if bucket_start and bucket_start + 2 < len(parts):
                bucket = parts[bucket_start + 1].split('.')[0]
                key = '/'.join(parts[bucket_start + 3:])
                return f"{bucket}/{key}"
    return None

def process_s3_event(event_record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Xử lý S3 event (khi có ảnh mới upload)
    """
    try:
        s3_obj = event_record['s3']
        bucket = s3_obj['bucket']['name']
        key = s3_obj['object']['key']
        
        logger.info(f"📸 Processing S3 event: s3://{bucket}/{key}")
        
        # Tìm photo trong DB theo s3_url
        s3_url = f"s3://{bucket}/{key}"
        photo = get_photo_from_s3_url(s3_url)
        
        if not photo:
            logger.warning(f"⚠️ Photo not found in DB for: {s3_url}")
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Photo not found in database'})
            }
        
        if photo['photo_type'] != 'menu':
            logger.info(f"ℹ️ Photo type is '{photo['photo_type']}', skipping OCR (only process 'menu' type)")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Skipped - not a menu photo'})
            }
        
        # Thực hiện OCR
        ocr_result = ocr_image_from_s3(bucket, key)
        
        # Tạo structured data
        ocr_structured = {
            'items': ocr_result['items'],
            'extracted_at': datetime.now().isoformat(),
            'item_count': len(ocr_result['items'])
        }
        
        # Update vào DB
        success = update_photo_ocr(
            photo_id=photo['id'],
            ocr_text=ocr_result['full_text'],
            ocr_structured=ocr_structured
        )
        
        if success:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'photo_id': photo['id'],
                    'items_count': len(ocr_result['items']),
                    'message': 'OCR completed successfully'
                })
            }
        else:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to update database'})
            }
            
    except Exception as e:
        logger.error(f"❌ Error processing S3 event: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def process_sqs_event(event_record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Xử lý SQS message (khi backend gửi job qua queue)
    Format message body: { "photo_id": "..." }
    """
    try:
        body = json.loads(event_record['body'])
        photo_id = body.get('photo_id')
        
        if not photo_id:
            logger.error("❌ Missing photo_id in SQS message")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing photo_id'})
            }
        
        logger.info(f"📸 Processing SQS event for photo_id: {photo_id}")
        
        # Lấy thông tin photo từ DB
        photo = get_photo_from_db(photo_id)
        
        if not photo:
            logger.error(f"❌ Photo {photo_id} not found in DB")
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Photo not found'})
            }
        
        if photo['photo_type'] != 'menu':
            logger.info(f"ℹ️ Photo type is '{photo['photo_type']}', skipping OCR")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Skipped - not a menu photo'})
            }
        
        # Extract S3 bucket và key từ s3_url
        s3_key_full = extract_s3_key_from_url(photo['s3_url'])
        if not s3_key_full:
            logger.error(f"❌ Could not parse S3 key from URL: {photo['s3_url']}")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid S3 URL'})
            }
        
        parts = s3_key_full.split('/', 1)
        if len(parts) != 2:
            logger.error(f"❌ Invalid S3 key format: {s3_key_full}")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid S3 key format'})
            }
        
        bucket = parts[0]
        key = parts[1]
        
        # Thực hiện OCR
        ocr_result = ocr_image_from_s3(bucket, key)
        
        # Tạo structured data
        ocr_structured = {
            'items': ocr_result['items'],
            'extracted_at': datetime.now().isoformat(),
            'item_count': len(ocr_result['items'])
        }
        
        # Update vào DB
        success = update_photo_ocr(
            photo_id=photo_id,
            ocr_text=ocr_result['full_text'],
            ocr_structured=ocr_structured
        )
        
        if success:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'photo_id': photo_id,
                    'items_count': len(ocr_result['items']),
                    'message': 'OCR completed successfully'
                })
            }
        else:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to update database'})
            }
            
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in SQS message: {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON in message body'})
        }
    except Exception as e:
        logger.error(f"❌ Error processing SQS event: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler
    Hỗ trợ 2 loại event:
    1. S3 Event (khi upload ảnh mới)
    2. SQS Event (khi backend gửi job)
    """
    logger.info(f"🚀 Lambda OCR Menu triggered. Event keys: {list(event.keys())}")
    
    try:
        # Kiểm tra loại event
        if 'Records' in event:
            # S3 hoặc SQS event
            results = []
            for record in event['Records']:
                if 's3' in record:
                    # S3 event
                    result = process_s3_event(record)
                    results.append(result)
                elif 'eventSource' in record and 'sqs' in record.get('eventSource', '').lower():
                    # SQS event
                    result = process_sqs_event(record)
                    results.append(result)
                else:
                    logger.warning(f"⚠️ Unknown record type: {record.keys()}")
            
            # Trả về kết quả đầu tiên (Lambda có thể xử lý batch)
            if results:
                return results[0]
            else:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'No valid records found'})
                }
        else:
            # Direct invocation (test)
            logger.info("ℹ️ Direct invocation - expecting photo_id in event")
            photo_id = event.get('photo_id')
            if photo_id:
                return process_sqs_event({'body': json.dumps({'photo_id': photo_id})})
            else:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Missing photo_id in event'})
                }
                
    except Exception as e:
        logger.error(f"❌ Lambda handler error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

