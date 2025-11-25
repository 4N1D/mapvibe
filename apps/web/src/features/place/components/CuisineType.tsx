import { UtensilsCrossed } from "lucide-react";

export interface Cuisine {
  name: string;
  description: string;
}

interface CuisineTypeProps {
  cuisineTypes: Cuisine[];
}

export function CuisineType({ cuisineTypes }: CuisineTypeProps) {
  return (
    <div className="mb-8">
      <h3 className="mb-6 text-2xl font-bold text-gray-900">Loại hình ẩm thực</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cuisineTypes.map((type, idx) => (
          <div
            key={idx}
            className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Background Icon */}
            <div className="absolute -right-4 -top-4 opacity-[0.03]">
              <UtensilsCrossed className="h-32 w-32" />
            </div>

            <h4 className="mb-2 text-sm font-bold uppercase text-[#085B96]">{type.name}</h4>
            <p className="text-sm leading-relaxed text-gray-500">{type.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
