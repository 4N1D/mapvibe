import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";

// List of all 18 services with their feature IDs
const ALL_SERVICES = [
  { id: "wifi", label: "Có wifi" },
  { id: "card_payment", label: "Trả bằng thẻ" },
  { id: "private_room", label: "Có phòng riêng" },
  { id: "smoking_area", label: "Có khu vực hút thuốc" },
  { id: "wheelchair_accessible", label: "Có hỗ trợ người khuyết tật" },
  { id: "delivery", label: "Có giao hàng" },
  { id: "car_parking", label: "Có chỗ đậu ôtô" },
  { id: "kids_play_area", label: "Có chỗ chơi cho trẻ em" },
  { id: "membership_card", label: "Có thẻ thành viên" },
  { id: "football_streaming", label: "Có chiếu bóng đá" },
  { id: "air_conditioning", label: "Có máy lạnh và điều hòa" },
  { id: "reservation", label: "Nên đặt trước" },
  { id: "free_motorbike_parking", label: "Giữ xe máy miễn phí" },
  { id: "vat_invoice", label: "Có xuất hóa đơn đỏ" },
  { id: "takeaway", label: "Cho mua về" },
  { id: "outdoor_seating", label: "Có bàn ngoài trời" },
  { id: "tipping", label: "Tip cho nhân viên" },
  { id: "heater", label: "Có lò sưởi" },
];

const INITIAL_SERVICES_SHOWN = 6;

export interface FilterState {
  trends: {
    hot: boolean;
    newest: boolean;
    oldest: boolean;
  };
  categories: string[];
  services: string[];
  status: string[];
  priceRange: {
    min: string;
    max: string;
  };
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <p className="font-semibold text-gray-900">{title}</p>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FilterContentProps {
  draftFilters: FilterState;
  setDraftFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onApply: () => void;
  onReset: () => void;
  hasFilters: boolean;
}

function FilterContent({
  draftFilters,
  setDraftFilters,
  onApply,
  onReset,
  hasFilters,
}: FilterContentProps) {
  const [showAllServices, setShowAllServices] = useState(false);
  const displayedServices = showAllServices
    ? ALL_SERVICES
    : ALL_SERVICES.slice(0, INITIAL_SERVICES_SHOWN);

  return (
    <>
      <div className="flex-1 space-y-1 overflow-y-auto text-sm text-gray-700">
        {/* Xu hướng */}
        <CollapsibleSection title="Xu hướng" defaultOpen={true}>
          <div className="space-y-1 pt-1">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draftFilters.trends.hot}
                onChange={(e) => {
                  setDraftFilters((prev) => ({
                    ...prev,
                    trends: {
                      ...prev.trends,
                      hot: e.target.checked,
                      newest: e.target.checked ? false : prev.trends.newest,
                      oldest: e.target.checked ? false : prev.trends.oldest,
                    },
                  }));
                }}
                className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span>Đang hot</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draftFilters.trends.newest}
                onChange={(e) => {
                  setDraftFilters((prev) => ({
                    ...prev,
                    trends: {
                      ...prev.trends,
                      newest: e.target.checked,
                      hot: e.target.checked ? false : prev.trends.hot,
                      oldest: e.target.checked ? false : prev.trends.oldest,
                    },
                  }));
                }}
                className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span>Mới nhất</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draftFilters.trends.oldest}
                onChange={(e) => {
                  setDraftFilters((prev) => ({
                    ...prev,
                    trends: {
                      ...prev.trends,
                      oldest: e.target.checked,
                      hot: e.target.checked ? false : prev.trends.hot,
                      newest: e.target.checked ? false : prev.trends.newest,
                    },
                  }));
                }}
                className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span>Cũ nhất</span>
            </label>
          </div>
        </CollapsibleSection>

        {/* Trạng thái */}
        <CollapsibleSection title="Theo trạng thái" defaultOpen={true}>
          <div className="space-y-1 pt-1">
            {["Đã kiểm duyệt", "Chưa kiểm duyệt"].map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={draftFilters.status.includes(item)}
                  onChange={(e) => {
                    setDraftFilters((prev) => ({
                      ...prev,
                      status: e.target.checked
                        ? [...prev.status, item]
                        : prev.status.filter((s) => s !== item),
                    }));
                  }}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>

        {/* Dịch vụ - default collapsed, với "Xem thêm" */}
        <CollapsibleSection title="Theo dịch vụ" defaultOpen={false}>
          <div className="space-y-1 pt-1">
            {displayedServices.map((service) => (
              <label key={service.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={draftFilters.services.includes(service.id)}
                  onChange={(e) => {
                    setDraftFilters((prev) => ({
                      ...prev,
                      services: e.target.checked
                        ? [...prev.services, service.id]
                        : prev.services.filter((s) => s !== service.id),
                    }));
                  }}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm">{service.label}</span>
              </label>
            ))}
            {ALL_SERVICES.length > INITIAL_SERVICES_SHOWN && (
              <button
                onClick={() => setShowAllServices(!showAllServices)}
                className="mt-2 text-sm font-medium text-primary-500 hover:text-primary-600"
              >
                {showAllServices
                  ? "Thu gọn"
                  : `Xem thêm ${ALL_SERVICES.length - INITIAL_SERVICES_SHOWN} dịch vụ`}
              </button>
            )}
          </div>
        </CollapsibleSection>

        {/* Khoảng giá */}
        <CollapsibleSection title="Theo khoảng giá" defaultOpen={false}>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Từ"
              value={draftFilters.priceRange.min}
              onChange={(e) => {
                setDraftFilters((prev) => ({
                  ...prev,
                  priceRange: { ...prev.priceRange, min: e.target.value },
                }));
              }}
              className="w-1/2 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <input
              type="text"
              placeholder="Đến"
              value={draftFilters.priceRange.max}
              onChange={(e) => {
                setDraftFilters((prev) => ({
                  ...prev,
                  priceRange: { ...prev.priceRange, max: e.target.value },
                }));
              }}
              className="w-1/2 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </CollapsibleSection>
      </div>

      {/* Buttons */}
      <div className="shrink-0 border-t border-gray-100 bg-white pt-4">
        <div className="flex gap-2">
          <button
            onClick={onApply}
            className="flex-1 rounded-lg bg-primary-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600"
          >
            Áp dụng
          </button>
          {hasFilters && (
            <button
              onClick={onReset}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </>
  );
}

interface LocationFilterSidebarProps {
  draftFilters: FilterState;
  setDraftFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onApply: () => void;
  onReset: () => void;
}

export function LocationFilterSidebar({
  draftFilters,
  setDraftFilters,
  onApply,
  onReset,
}: LocationFilterSidebarProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const hasFilters =
    draftFilters.trends.hot ||
    draftFilters.trends.newest ||
    draftFilters.trends.oldest ||
    draftFilters.categories.length > 0 ||
    draftFilters.services.length > 0 ||
    draftFilters.status.length > 0 ||
    draftFilters.priceRange.min !== "" ||
    draftFilters.priceRange.max !== "";

  const activeFilterCount =
    (draftFilters.trends.hot ? 1 : 0) +
    (draftFilters.trends.newest ? 1 : 0) +
    (draftFilters.trends.oldest ? 1 : 0) +
    draftFilters.status.length +
    draftFilters.services.length +
    (draftFilters.priceRange.min || draftFilters.priceRange.max ? 1 : 0);

  const handleMobileApply = () => {
    onApply();
    setMobileDrawerOpen(false);
  };

  const handleMobileReset = () => {
    onReset();
    setMobileDrawerOpen(false);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="relative hidden h-fit w-64 flex-col rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100vh-6rem)]">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 text-sm">
              <SlidersHorizontal className="h-4 w-4 text-gray-700" />
            </span>
            Bộ lọc địa điểm
          </h2>
          {hasFilters && (
            <button
              onClick={onReset}
              className="text-xs text-primary-500 hover:text-primary-600"
            >
              Reset
            </button>
          )}
        </div>
        <FilterContent
          draftFilters={draftFilters}
          setDraftFilters={setDraftFilters}
          onApply={onApply}
          onReset={onReset}
          hasFilters={hasFilters}
        />
      </aside>

      {/* Mobile: Floating Filter Button */}
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="flex items-center gap-2 rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-600"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Bộ lọc
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-primary-500">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile: Bottom Sheet Drawer */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
              onClick={() => setMobileDrawerOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-white lg:hidden"
            >
              {/* Handle */}
              <div className="flex shrink-0 items-center justify-center py-3">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 pb-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <SlidersHorizontal className="h-5 w-5" />
                  Bộ lọc địa điểm
                </h2>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-full p-1 transition hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col overflow-hidden px-4 py-4">
                <FilterContent
                  draftFilters={draftFilters}
                  setDraftFilters={setDraftFilters}
                  onApply={handleMobileApply}
                  onReset={handleMobileReset}
                  hasFilters={hasFilters}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
