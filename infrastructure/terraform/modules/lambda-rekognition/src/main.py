import os
import json
import boto3
import logging
from datetime import datetime
from typing import Dict, Any, Optional
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
rekognition_client = boto3.client('rekognition', region_name=AWS_REGION)
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
# REKOGNITION PROCESSING
# ============================================

def analyze_image_with_rekognition(bucket: str, key: str) -> Dict[str, Any]:
    """
    Phân tích ảnh với Rekognition
    Trả về: labels, moderation_labels, is_blurry, etc.
    """
    try:
        logger.info(f"🔍 Starting Rekognition analysis for s3://{bucket}/{key}")
        
        results = {}
        
        # 1. Detect Labels (nhận diện đối tượng)
        try:
            labels_response = rekognition_client.detect_labels(
                Image={'S3Object': {'Bucket': bucket, 'Name': key}},
                MaxLabels=20,
                MinConfidence=50.0
            )
            results['labels'] = labels_response.get('Labels', [])
            logger.info(f"✅ Detected {len(results['labels'])} labels")
        except ClientError as e:
            logger.warning(f"⚠️ Labels detection failed: {str(e)}")
            results['labels'] = []
        
        # 2. Moderation Labels (kiểm duyệt nội dung)
        try:
            moderation_response = rekognition_client.detect_moderation_labels(
                Image={'S3Object': {'Bucket': bucket, 'Name': key}},
                MinConfidence=50.0
            )
            moderation_labels = moderation_response.get('ModerationLabels', [])
            results['moderation_labels'] = moderation_labels
            
            # Tính is_safe: không có label nào với confidence > 70
            is_safe = all(label['Confidence'] < 70.0 for label in moderation_labels)
            results['is_safe'] = is_safe
            
            logger.info(f"✅ Moderation check: {'Safe' if is_safe else 'Unsafe'} ({len(moderation_labels)} issues)")
        except ClientError as e:
            logger.warning(f"⚠️ Moderation detection failed: {str(e)}")
            results['moderation_labels'] = []
            results['is_safe'] = True  # Default safe nếu lỗi
        
        # 3. Detect Text (OCR cơ bản, nếu cần)
        try:
            text_response = rekognition_client.detect_text(
                Image={'S3Object': {'Bucket': bucket, 'Name': key}}
            )
            text_detections = text_response.get('TextDetections', [])
            # Chỉ lấy text có Type = 'LINE'
            lines = [det['DetectedText'] for det in text_detections if det.get('Type') == 'LINE']
            results['detected_text'] = lines
            logger.info(f"✅ Detected {len(lines)} text lines")
        except ClientError as e:
            logger.warning(f"⚠️ Text detection failed: {str(e)}")
            results['detected_text'] = []
        
        # 4. Kiểm tra blur (dựa vào confidence của labels)
        # Nếu tất cả labels đều có confidence thấp, có thể ảnh bị blur
        label_confidences = [label['Confidence'] for label in results.get('labels', [])]
        is_blurry = len(label_confidences) > 0 and max(label_confidences) < 60.0
        results['is_blurry'] = is_blurry
        
        if is_blurry:
            logger.warning("⚠️ Image appears to be blurry")
        
        logger.info(f"✅ Rekognition analysis completed")
        return results
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"❌ Rekognition error ({error_code}): {str(e)}")
        raise
    except Exception as e:
        logger.error(f"❌ Rekognition processing error: {str(e)}")
        raise

# ============================================
# DATABASE OPERATIONS
# ============================================

def get_photo_from_s3_url(s3_url: str) -> Optional[Dict[str, Any]]:
    """Lấy thông tin photo từ DB theo s3_url"""
    if not engine:
        return None
    
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT id, restaurant_id, photo_type, s3_url,
                           moderation_labels, is_safe, is_blurry
                    FROM photos
                    WHERE s3_url = :s3_url
                    LIMIT 1
                """),
                {"s3_url": s3_url}
            ).fetchone()
            
            if result:
                return {
                    'id': result[0],
                    'restaurant_id': result[1],
                    'photo_type': result[2],
                    's3_url': result[3],
                    'moderation_labels': result[4],
                    'is_safe': result[5],
                    'is_blurry': result[6]
                }
            return None
    except Exception as e:
        logger.error(f"❌ Error querying photo by S3 URL: {str(e)}")
        return None

def update_photo_rekognition(
    photo_id: str,
    labels: list,
    moderation_labels: list,
    is_safe: bool,
    is_blurry: bool
):
    """Update Rekognition kết quả vào DB"""
    if not engine:
        logger.error("❌ Database engine not initialized")
        return False
    
    try:
        with engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE photos
                    SET moderation_labels = :moderation_labels::jsonb,
                        is_safe = :is_safe,
                        is_blurry = :is_blurry,
                        processed_at = NOW()
                    WHERE id = :photo_id
                """),
                {
                    "photo_id": photo_id,
                    "moderation_labels": json.dumps({
                        "labels": labels,
                        "moderation_labels": moderation_labels,
                        "analyzed_at": datetime.now().isoformat()
                    }),
                    "is_safe": is_safe,
                    "is_blurry": is_blurry
                }
            )
            conn.commit()
            logger.info(f"✅ Updated Rekognition results for photo {photo_id}")
            return True
    except Exception as e:
        logger.error(f"❌ Error updating photo Rekognition: {str(e)}")
        return False

# ============================================
# LAMBDA HANDLERS
# ============================================

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
        
        # Phân tích với Rekognition
        rekognition_results = analyze_image_with_rekognition(bucket, key)
        
        # Update vào DB
        success = update_photo_rekognition(
            photo_id=photo['id'],
            labels=rekognition_results.get('labels', []),
            moderation_labels=rekognition_results.get('moderation_labels', []),
            is_safe=rekognition_results.get('is_safe', True),
            is_blurry=rekognition_results.get('is_blurry', False)
        )
        
        if success:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'photo_id': photo['id'],
                    'is_safe': rekognition_results.get('is_safe'),
                    'is_blurry': rekognition_results.get('is_blurry'),
                    'labels_count': len(rekognition_results.get('labels', [])),
                    'message': 'Rekognition analysis completed successfully'
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

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler
    Xử lý S3 Event (khi upload ảnh mới)
    """
    logger.info(f"🚀 Lambda Rekognition triggered. Event keys: {list(event.keys())}")
    
    try:
        # Kiểm tra loại event
        if 'Records' in event:
            # S3 event
            results = []
            for record in event['Records']:
                if 's3' in record:
                    result = process_s3_event(record)
                    results.append(result)
                else:
                    logger.warning(f"⚠️ Unknown record type: {record.keys()}")
            
            # Trả về kết quả đầu tiên
            if results:
                return results[0]
            else:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'No valid S3 records found'})
                }
        else:
            # Direct invocation (test)
            logger.info("ℹ️ Direct invocation - expecting bucket and key in event")
            bucket = event.get('bucket')
            key = event.get('key')
            if bucket and key:
                return process_s3_event({
                    's3': {
                        'bucket': {'name': bucket},
                        'object': {'key': key}
                    }
                })
            else:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Missing bucket or key in event'})
                }
                
    except Exception as e:
        logger.error(f"❌ Lambda handler error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

