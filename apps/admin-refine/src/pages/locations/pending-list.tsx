import { useGo, useTable } from '@refinedev/core';
import { List as AntdList, Card, Badge, Button, Spin, Empty } from 'antd';
import { EnvironmentOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const LocationsPendingList = () => {
  const go = useGo();
  
  const { tableQueryResult } = useTable({
    resource: 'locations/pending',
    pagination: {
      pageSize: 20,
    },
  });

  const { data, isLoading } = tableQueryResult;
  const locations = data?.data || [];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Empty description="No pending locations" />
      </div>
    );
  }

  return (
    <div>
      <h1>Pending Locations ({locations.length})</h1>
      
      <AntdList
        grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
        dataSource={locations}
        renderItem={(location: any) => (
          <AntdList.Item>
            <Card
              hoverable
              actions={[
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => go({
                    to: `/locations/${location.id}`,
                    type: 'push',
                  })}
                >
                  Review
                </Button>,
              ]}
            >
              <Card.Meta
                avatar={<EnvironmentOutlined style={{ fontSize: 32, color: '#3b82f6' }} />}
                title={
                  <div>
                    {location.restaurant_name || 'Unknown Place'}
                    <Badge
                      count={location.review_count || 0}
                      style={{ marginLeft: 8 }}
                      showZero
                    />
                  </div>
                }
                description={
                  <>
                    <div style={{ marginBottom: 8 }}>{location.full_address}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {location.review_count} reviews · {dayjs(location.created_at).fromNow()}
                    </div>
                  </>
                }
              />
            </Card>
          </AntdList.Item>
        )}
      />
    </div>
  );
};
