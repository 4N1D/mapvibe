interface ServicesListProps {
  services: string[];
}

export function ServicesList({ services }: ServicesListProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-[0_0_25px_rgba(0,0,0,0.2)]">
      <h3 className="mb-4 text-3xl font-bold text-gray-900">Dịch vụ</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {services.map((service, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2"
          >
            <img
              src="/icons/checked.png"
              alt="Checked"
              className="h-5 w-5 object-contain"
            />
            <span className="text-base font-medium text-gray-700">{service}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
