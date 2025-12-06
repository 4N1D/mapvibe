import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

/**
 * Gửi message vào SQS queue để trigger Lambda Embedding
 * @param restaurantId - ID của restaurant cần tạo embedding
 * @returns Promise<boolean> - true nếu thành công, false nếu thất bại
 */
export async function sendEmbeddingJob(restaurantId: string): Promise<boolean> {
  const queueUrl = process.env.SQS_EMBEDDING_QUEUE_URL;

  if (!queueUrl) {
    console.warn("[SQS] SQS_EMBEDDING_QUEUE_URL not configured, skipping embedding job");
    return false;
  }

  if (!restaurantId) {
    console.error("[SQS] restaurantId is required");
    return false;
  }

  try {
    const messageBody = JSON.stringify({
      restaurant_id: restaurantId,
    });

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: messageBody,
    });

    const response = await sqsClient.send(command);
    console.log(`[SQS] ✅ Sent embedding job for restaurant ${restaurantId}, MessageId: ${response.MessageId}`);
    return true;
  } catch (error) {
    console.error(`[SQS] ❌ Failed to send embedding job for restaurant ${restaurantId}:`, error);
    // Không throw error để không ảnh hưởng đến flow chính
    return false;
  }
}

