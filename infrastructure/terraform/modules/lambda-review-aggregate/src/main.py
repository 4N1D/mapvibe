import json
import os
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

import boto3
from botocore.exceptions import ClientError
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

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


def call_bedrock_retry(messages: List[Dict[str, Any]], max_retries: int = 3):
    for i in range(max_retries):
        try:
            response = bedrock_client.converse(
                modelId=MODEL_CHAT,
                messages=messages,
                inferenceConfig={"temperature": 0.2},
            )
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


def fetch_reviews_and_comments(location_address_id: str):
    if not engine:
        raise Exception("Database engine not initialized")

    with engine.connect() as conn:
        reviews = conn.execute(
            text(
                """
                SELECT id, text, features, upvote_count, created_at
                FROM review_posts
                WHERE location_address_id = :loc
                  AND status = 'pending'
                  AND upvote_count > 0
                ORDER BY upvote_count DESC, created_at DESC
                LIMIT 10
                """
            ),
            {"loc": location_address_id},
        ).fetchall()

        comments = conn.execute(
            text(
                """
                SELECT c.id, c.text, c.upvote_count, c.created_at
                FROM comments c
                JOIN review_posts rp ON c.review_post_id = rp.id
                WHERE rp.location_address_id = :loc
                  AND rp.status = 'pending'
                  AND c.status = 'pending'
                  AND c.upvote_count > 0
                ORDER BY c.upvote_count DESC, c.created_at DESC
                LIMIT 10
                """
            ),
            {"loc": location_address_id},
        ).fetchall()

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
            "upvote_count": int(row.upvote_count or 0),
            "created_at": row.created_at.isoformat() if isinstance(row.created_at, datetime) else str(row.created_at),
        }

    return [serialize_review(r) for r in reviews], [serialize_comment(c) for c in comments]


def build_prompt(reviews: List[Dict[str, Any]], comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    reviews_str = "\n".join(
        [
            f"- Review {r['id']} (upvotes {r['upvote_count']}): {r['text']} | features: {', '.join(r.get('features') or [])}"
            for r in reviews
        ]
    ) or "None"

    comments_str = "\n".join(
        [f"- Comment {c['id']} (upvotes {c['upvote_count']}): {c['text']}" for c in comments]
    ) or "None"

    system_prompt = (
        "Bạn là hệ thống tổng hợp dữ liệu nhà hàng. "
        "Dùng thông tin dưới đây để suy luận các trường. "
        "Chỉ trả về JSON với các thuộc tính: "
        "name_vi, slug, address, district, ward, phone, website, geo_lat, geo_lng, "
        "business_type, cuisine_types, price_min, price_max, opening_hours, "
        "description, features. "
        "Nếu thiếu thông tin, trả về null cho field đó (features và cuisine_types: mảng, có thể rỗng). "
        "price_min/price_max là integer. opening_hours phải ở format 'HH:MM - HH:MM' hoặc null. "
        "Không tự bịa địa chỉ hay toạ độ nếu không có căn cứ."
    )

    user_prompt = f"""Dữ liệu review (top 10 upvote, status pending):
{reviews_str}

Top comment (top 10 upvote, status pending):
{comments_str}

Hãy tổng hợp và trả JSON."""

    return [
        {"role": "system", "content": [{"text": system_prompt}]},
        {"role": "user", "content": [{"text": user_prompt}]},
    ]


def aggregate(location_address_id: str):
    reviews, comments = fetch_reviews_and_comments(location_address_id)

    messages = build_prompt(reviews, comments)
    response = call_bedrock_retry(messages)
    if not response:
        raise Exception("Bedrock returned empty response")

    text_blocks = response["output"]["message"]["content"]
    output_text = ""
    for block in text_blocks:
        if "text" in block:
            output_text += block["text"]

    try:
        payload = json.loads(output_text)
    except json.JSONDecodeError:
        logger.warning("LLM output is not valid JSON, wrapping as string")
        payload = {"raw": output_text}

    return {
        "location_address_id": location_address_id,
        "reviews_used": [r["id"] for r in reviews],
        "comments_used": [c["id"] for c in comments],
        "result": payload,
    }


def lambda_handler(event, context):
    try:
        if event.get("body"):
            body = json.loads(event["body"])
        else:
            body = {}
        location_address_id = body.get("location_address_id") or (event.get("queryStringParameters") or {}).get(
            "location_address_id"
        )
        if not location_address_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "location_address_id is required"}),
            }

        result = aggregate(location_address_id)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(result),
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }

