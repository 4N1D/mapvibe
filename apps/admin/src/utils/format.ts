export function getFeatureLabel(feature: string): string {
  const featureLabels: Record<string, string> = {
    // New features from web app
    wifi: "Có wifi",
    delivery: "Có giao hàng",
    air_conditioning: "Có máy lạnh & điều hòa",
    takeaway: "Cho mua về",
    card_payment: "Trả bằng thẻ",
    car_parking: "Có chỗ đậu ôtô",
    reservation: "Nên đặt trước",
    outdoor_seating: "Có bàn ngoài trời",
    private_room: "Có phòng riêng",
    kids_play_area: "Có chỗ chơi cho trẻ em",
    free_motorbike_parking: "Giữ xe máy miễn phí",
    tipping: "Tip cho nhân viên",
    smoking_area: "Có khu vực hút thuốc",
    membership_card: "Có thẻ thành viên",
    vat_invoice: "Có xuất hóa đơn đỏ",
    heater: "Có lò sưởi",
    wheelchair_accessible: "Có hỗ trợ người khuyết tật",
    football_streaming: "Có chiếu bóng đá",

    // Legacy mappings (keep for backward compatibility)
    parking: "Giữ xe miễn phí",
    air_con: "Máy lạnh",
    credit_card: "Thanh toán thẻ",
    outdoor: "Chỗ ngồi ngoài trời",
  };

  return featureLabels[feature] || feature;
}

export const ALL_FEATURES = [
  "wifi",
  "delivery",
  "air_conditioning",
  "takeaway",
  "card_payment",
  "car_parking",
  "reservation",
  "outdoor_seating",
  "private_room",
  "kids_play_area",
  "free_motorbike_parking",
  "tipping",
  "smoking_area",
  "membership_card",
  "vat_invoice",
  "heater",
  "wheelchair_accessible",
  "football_streaming",
  // Legacy
  "parking",
  "air_con",
  "credit_card",
  "outdoor",
];
