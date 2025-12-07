import { useCustom } from '@refinedev/core';
import { Card, Col, Row, Statistic, Spin } from 'antd';
import {
  UserOutlined,
  ShopOutlined,
  StarOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';

export const DashboardPage = () => {
  const { data, isLoading } = useCustom({
    url: '/admin/stats',
    method: 'get',
  });

  const stats = data?.data?.stats || {};
  const activity = data?.data?.recent_activity || {};

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h1>Dashboard</h1>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.total_users || 0}
              prefix={<UserOutlined />}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              +{activity.new_users_7d || 0} this week
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Places"
              value={stats.total_places || 0}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Reviews"
              value={stats.total_reviews || 0}
              prefix={<StarOutlined />}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              +{activity.new_reviews_7d || 0} this week
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending Locations"
              value={stats.pending_locations || 0}
              prefix={<EnvironmentOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Recent Activity (7 days)" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic title="New Users" value={activity.new_users_7d || 0} />
          </Col>
          <Col span={8}>
            <Statistic title="New Reviews" value={activity.new_reviews_7d || 0} />
          </Col>
          <Col span={8}>
            <Statistic title="New Photos" value={activity.new_photos_7d || 0} />
          </Col>
        </Row>
      </Card>
    </div>
  );
};
