interface ServicesListProps {
  services: string[];
}

export function ServicesList({ services }: ServicesListProps) {
  if (!services || services.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-3xl font-bold text-gray-900">Tiện ích</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {services.map((service, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2"
          >
            <img
              src="/icons/checked.png"
              alt="Checked"
              className="h-5 w-5 shrink-0 object-contain"
            />
            <span className="text-base font-medium text-gray-700">{service}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
