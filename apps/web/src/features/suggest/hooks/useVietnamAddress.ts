import { useState, useEffect } from "react";
import type { Province, Ward } from "../types";

const API_BASE = "https://tinhthanhpho.com/api/v1";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
    total: number;
    page: number;
    limit: number;
  };
}

interface ProvinceApi {
  code: string;
  name: string;
  type: string;
}

interface WardApi {
  code: string;
  name: string;
  type: string;
  province_code: string;
}

export function useVietnamAddress() {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const res = await fetch(`${API_BASE}/new-provinces?limit=100`);
        const json: ApiResponse<ProvinceApi[]> = await res.json();
        if (json.success && json.data) {
          setProvinces(
            json.data.map((p) => ({
              code: p.code,
              name: p.name,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch provinces:", error);
      }
    };
    fetchProvinces();
  }, []);

  useEffect(() => {
    if (!selectedProvince) {
      setWards([]);
      return;
    }

    const fetchWards = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/new-provinces/${selectedProvince}/wards?limit=500`);
        const json: ApiResponse<WardApi[]> = await res.json();
        if (json.success && json.data) {
          setWards(
            json.data.map((w) => ({
              code: w.code,
              name: w.name,
              provinceCode: w.province_code,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch wards:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchWards();
  }, [selectedProvince]);

  const selectProvince = (code: string) => {
    setSelectedProvince(code);
  };

  return {
    provinces,
    wards,
    selectedProvince,
    selectProvince,
    loading,
  };
}
