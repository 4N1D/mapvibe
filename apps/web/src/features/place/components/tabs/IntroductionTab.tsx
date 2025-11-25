import { ServicesList } from "../ServicesList";
import { CuisineType, Cuisine } from "../CuisineType";
import { SimilarPlaces } from "../SimilarPlaces";
import { DirectionSidebar } from "../DirectionSidebar";

interface IntroductionTabProps {
  services: string[];
  cuisineTypes: Cuisine[];
  similarPlaces: any[];
  address: string;
  lat?: number;
  lng?: number;
}

export function IntroductionTab({
  services,
  cuisineTypes,
  similarPlaces,
  address,
  lat,
  lng,
}: IntroductionTabProps) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <main className="space-y-6 lg:col-span-2">
        <ServicesList services={services} />
        <CuisineType cuisineTypes={cuisineTypes} />

        <div className="block lg:hidden">
          <DirectionSidebar
            address={address}
            lat={lat}
            lng={lng}
          />
        </div>

        <SimilarPlaces places={similarPlaces} />
      </main>

      <aside className="hidden lg:block">
        <DirectionSidebar
          address={address}
          lat={lat}
          lng={lng}
        />
      </aside>
    </div>
  );
}
