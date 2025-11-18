import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Rating,
} from "@mapvibe/ui-components";
import { useState } from "react";

export default function App() {
  const [rating, setRating] = useState(3);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            MapVibe UI Components
          </h1>
          <p className="text-lg text-gray-600">
            Testing Button, Card, and Rating components
          </p>
        </div>

        {/* Button Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Button Component</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Variants
              </h4>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Sizes
              </h4>
              <div className="flex flex-wrap gap-3 items-center">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                States
              </h4>
              <div className="flex flex-wrap gap-3">
                <Button>Normal</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rating Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Component</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Interactive Rating
              </h4>
              <div className="flex items-center gap-4">
                <Rating value={rating} onChange={setRating} size="md" />
                <span className="text-lg font-medium text-gray-700">
                  {rating} / 5
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Read-only Rating
              </h4>
              <Rating value={4} readOnly size="md" />
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Different Sizes
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-20">Small:</span>
                  <Rating value={3} readOnly size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-20">Medium:</span>
                  <Rating value={3} readOnly size="md" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-20">Large:</span>
                  <Rating value={3} readOnly size="lg" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Example */}
        <Card>
          <CardHeader>
            <CardTitle>Card Component</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              This is an example card with header, title, and content sections.
              You can use it to organize content in a clean, structured way.
            </p>
          </CardContent>
        </Card>
        <div className="bg-red-500 p-4 text-white">
          Test Tailwind - Nếu thấy background đỏ = Tailwind OK
        </div>
      </div>
    </div>
  );
}
