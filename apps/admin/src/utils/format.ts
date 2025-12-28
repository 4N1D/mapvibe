// Helper to map feature IDs to display labels
export const ALL_FEATURES = [
  // Tiện ích cơ bản
  "wifi",
  "delivery",
  "air_con",
  "air_conditioning",
  "takeaway",
  "parking",
  // Thanh toán và dịch vụ
  "card_payment",
  "car_parking",
  "reservation",
  "outdoor_seating",
  "private_room",
  // Tiện ích đặc biệt
  "kids_play_area",
  "free_motorbike_parking",
  "tipping",
  "smoking_area",
  "membership_card",
  // Dịch vụ bổ sung
  "vat_invoice",
  "heater",
  "wheelchair_accessible",
  "football_streaming",
];

export const getFeatureLabel = (featureId: string): string => {
  const featureMap: Record<string, string> = {
    // Tiện ích cơ bản
    wifi: "Có wifi",
    delivery: "Có giao hàng",
    air_con: "Có máy lạnh và điều hòa",
    air_conditioning: "Có máy lạnh và điều hòa", // API có thể trả về air_conditioning
    takeaway: "Cho mua về",
    parking: "Có chỗ đậu xe",

    // Thanh toán và dịch vụ
    card_payment: "Trả bằng thẻ",
    car_parking: "Có chỗ đậu ôtô",
    reservation: "Nên đặt trước",
    outdoor_seating: "Có bàn ngoài trời",
    private_room: "Có phòng riêng",

    // Tiện ích đặc biệt
    kids_play_area: "Có chỗ chơi cho trẻ em",
    free_motorbike_parking: "Giữ xe máy miễn phí",
    tipping: "Tip cho nhân viên",
    smoking_area: "Có khu vực hút thuốc",
    membership_card: "Có thẻ thành viên",

    // Dịch vụ bổ sung
    vat_invoice: "Có xuất hóa đơn đỏ",
    heater: "Có lò sưởi",
    wheelchair_accessible: "Có hỗ trợ người khuyết tật",
    football_streaming: "Có chiếu bóng đá",
  };
  return featureMap[featureId] || featureId;
};