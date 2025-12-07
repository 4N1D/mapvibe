import { useState } from 'react';
import { useShow, useCustomMutation, useGo, useTable } from '@refinedev/core';
import { useParams } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Checkbox,
  message,
  Spin,
  Typography,
  Space,
  Tag,
  Modal,
  List as AntdList,
  Empty,
} from 'antd';
import {
  RobotOutlined,
  CheckOutlined,
  CloseOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

export const LocationsDetailPage = () => {
  const { id } = useParams();
  const go = useGo();
  const [form] = Form.useForm();
  const [isAggregating, setIsAggregating] = useState(false);

  // Fetch location data
  const { queryResult } = useShow({
    resource: 'locations',
    id,
  });

  const location = queryResult.data?.data;
  const isLoading = queryResult.isLoading;

  // Mutations
  const { mutate: updateLocation } = useCustomMutation();

  // Handle AI Aggregate
  const handleAIAggregate = async () => {
    setIsAggregating(true);
    
    updateLocation(
      {
        url: '/reviews/aggregate-pending',
        method: 'post',
        values: { location_id: id },
        successNotification: false,
      },
      {
        onSuccess: (data: any) => {
          message.success('AI aggregated data successfully!');
          
          // Fill form with aggregated data
          const aggregated = data.data;
          form.setFieldsValue({
            name_vi: aggregated.name,
            cuisine_types: aggregated.cuisine_types || [],
            price_min: aggregated.price_min,
            price_max: aggregated.price_max,
            opening_hours: aggregated.hours,
            features: aggregated.features || [],
            description: aggregated.description,
          });
          
          setIsAggregating(false);
        },
        onError: () => {
          message.error('Failed to aggregate data');
          setIsAggregating(false);
        },
      }
    );
  };

  // Handle Approve
  const handleApprove = () => {
    form.validateFields().then((values) => {
      Modal.confirm({
        title: 'Approve Location',
        content: 'Are you sure you want to approve this location and create the restaurant?',
        onOk: () => {
          updateLocation(
            {
              url: `/admin/locations/${id}`,
              method: 'patch',
              values: { action: 'approve', ...values },
              successNotification: false,
            },
            {
              onSuccess: () => {
                message.success('Location approved successfully!');
                go({ to: '/locations/pending', type: 'push' });
              },
              onError: (error: any) => {
                message.error(error?.message || 'Failed to approve location');
              },
            }
          );
        },
      });
    });
  };

  // Handle Reject
  const handleReject = () => {
    let rejectionReason = '';
    
    Modal.confirm({
      title: 'Reject Location',
      content: (
        <TextArea
          placeholder="Reason for rejection (optional)"
          rows={3}
          onChange={(e) => { rejectionReason = e.target.value; }}
        />
      ),
      onOk: () => {
        updateLocation(
          {
            url: `/admin/locations/${id}`,
            method: 'patch',
            values: { action: 'reject', reason: rejectionReason },
            successNotification: false,
          },
          {
            onSuccess: () => {
              message.success('Location rejected');
              go({ to: '/locations/pending', type: 'push' });
            },
            onError: () => {
              message.error('Failed to reject location');
            },
          }
        );
      },
    });
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Button 
        icon={<ArrowLeftOutlined />}
        onClick={() => go({ to: '/locations/pending', type: 'push' })}
        style={{ marginBottom: 16 }}
      >
        Back to List
      </Button>
      
      <Title level={2}>{location?.restaurant_name || 'Unknown Place'}</Title>
      <Text type="secondary">{location?.full_address}</Text>

      <Row gutter={24} style={{ marginTop: 24 }}>
        {/* LEFT PANEL: Review Feed */}
        <Col xs={24} lg={12}>
          <Card title={`Reviews (${location?.review_count || 0})`} style={{ height: '100%' }}>
            <ReviewFeed locationId={id!} />
          </Card>
        </Col>

        {/* RIGHT PANEL: Restaurant Form */}
        <Col xs={24} lg={12}>
          <Card
            title="Restaurant Information"
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  onClick={handleAIAggregate}
                  loading={isAggregating}
                >
                  AI Aggregate
                </Button>
                <Button onClick={() => form.resetFields()}>
                  Reset
                </Button>
              </Space>
            }
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                name_vi: location?.restaurant_name,
                address: location?.street_address,
                district: location?.district,
                ward: location?.ward,
              }}
            >
              <Form.Item
                name="name_vi"
                label="Restaurant Name"
                rules={[{ required: true, message: 'Please enter restaurant name' }]}
              >
                <Input placeholder="E.g., Phở 79" />
              </Form.Item>

              <Form.Item name="address" label="Address">
                <Input disabled />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="district" label="District">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="ward" label="Ward">
                    <Input disabled />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="cuisine_types" label="Cuisine Types">
                <Select 
                  mode="tags" 
                  placeholder="Vietnamese, Pho, etc."
                  options={[
                    { value: 'Vietnamese', label: 'Vietnamese' },
                    { value: 'Pho', label: 'Phở' },
                    { value: 'Com Tam', label: 'Cơm Tấm' },
                    { value: 'Banh Mi', label: 'Bánh Mì' },
                    { value: 'Cafe', label: 'Cafe' },
                  ]}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="price_min" label="Min Price (VNĐ)">
                    <InputNumber 
                      style={{ width: '100%' }} 
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="price_max" label="Max Price (VNĐ)">
                    <InputNumber 
                      style={{ width: '100%' }}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="opening_hours" label="Opening Hours">
                <Input placeholder="7:00 - 22:00" />
              </Form.Item>

              <Form.Item name="features" label="Features">
                <Checkbox.Group>
                  <Row>
                    <Col span={12}><Checkbox value="wifi">WiFi</Checkbox></Col>
                    <Col span={12}><Checkbox value="parking">Parking</Checkbox></Col>
                    <Col span={12}><Checkbox value="air_con">Air Con</Checkbox></Col>
                    <Col span={12}><Checkbox value="credit_card">Credit Card</Checkbox></Col>
                    <Col span={12}><Checkbox value="delivery">Delivery</Checkbox></Col>
                    <Col span={12}><Checkbox value="outdoor">Outdoor Seating</Checkbox></Col>
                  </Row>
                </Checkbox.Group>
              </Form.Item>

              <Form.Item name="description" label="Description">
                <TextArea 
                  rows={4} 
                  placeholder="AI-generated description or manual entry"
                  showCount
                  maxLength={500}
                />
              </Form.Item>

              <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  onClick={handleReject}
                >
                  Reject
                </Button>
                <Button 
                  icon={<SaveOutlined />}
                  disabled
                  title="Save draft feature coming soon"
                >
                  Save Draft
                </Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleApprove}
                >
                  Approve
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Review Feed Component
const ReviewFeed = ({ locationId }: { locationId: string }) => {
  const { tableQueryResult } = useTable({
    resource: `locations/${locationId}/reviews`,
    queryOptions: {
      enabled: !!locationId,
    },
  });

  const reviews = tableQueryResult.data?.data || [];
  const isLoading = tableQueryResult.isLoading;

  if (isLoading) {
    return <Spin />;
  }

  if (reviews.length === 0) {
    return <Empty description="No reviews for this location" />;
  }

  return (
    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      <AntdList
        dataSource={reviews}
        renderItem={(review: any) => (
          <Card 
            size="small" 
            style={{ marginBottom: 12 }}
            bordered
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Text strong>{review.author_name || 'Anonymous'}</Text>
                <Text type="secondary">·</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(review.created_at).fromNow()}
                </Text>
              </div>
              
              {review.rating && (
                <div>
                  <Tag color="blue">⭐ {review.rating}/10</Tag>
                </div>
              )}
              
              <Paragraph 
                ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}
                style={{ marginBottom: 8 }}
              >
                {review.text || review.content}
              </Paragraph>

              {review.features && review.features.length > 0 && (
                <div>
                  {review.features.map((f: string, idx: number) => (
                    <Tag key={idx} color="green">{f}</Tag>
                  ))}
                </div>
              )}

              {review.price_mentioned && (
                <Tag color="orange">💰 {review.price_mentioned.toLocaleString()} VNĐ</Tag>
              )}

              {review.photos && review.photos.length > 0 && (
                <Button size="small" type="link">
                  📷 {review.photos.length} photos
                </Button>
              )}
            </Space>
          </Card>
        )}
      />
    </div>
  );
};
