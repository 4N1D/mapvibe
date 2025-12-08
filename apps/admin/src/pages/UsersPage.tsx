import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { adminApi } from "../lib/api";
import { Breadcrumbs, SkeletonTable } from "../components/ui";
import { useConfirm } from "../hooks/useConfirm";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () => adminApi.getUsers({ search, offset: page * 20, limit: 20 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => adminApi.updateUser(id, action),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(`Đã ${variables.action === "ban" ? "cấm" : "bỏ cấm"} người dùng`);
    },
    onError: () => {
      toast.error("Lỗi khi cập nhật người dùng");
    },
  });

  const users = data?.data?.users || [];
  const pagination = data?.data?.pagination || { total: 0 };
  const totalPages = Math.ceil(pagination.total / 20);

  const handleBan = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Cấm người dùng",
      message: `Bạn có chắc muốn cấm "${name}"? Họ sẽ không thể truy cập nền tảng.`,
      confirmText: "Cấm",
      variant: "danger",
    });
    if (confirmed) {
      updateMutation.mutate({ id, action: "ban" });
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      <Breadcrumbs items={[{ label: "Tổng quan", href: "/" }, { label: "Người dùng" }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Người dùng</h1>
          <p className="mt-1 text-sm text-gray-500">{pagination.total} người dùng đã đăng ký</p>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-primary-500 sm:w-72"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <SkeletonTable
          rows={10}
          cols={7}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Người dùng
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Email
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Điểm uy tín
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Vai trò
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Ngày tham gia
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        Không tìm thấy người dùng
                      </td>
                    </tr>
                  ) : (
                    users.map((user: Record<string, unknown>) => {
                      let roles: string[] = ["user"];
                      try {
                        if (typeof user.roles === "string") {
                          roles = JSON.parse(user.roles);
                        } else if (Array.isArray(user.roles)) {
                          roles = user.roles;
                        }
                      } catch (e) {
                        console.error("Failed to parse roles:", e);
                      }
                      const isAdmin = Array.isArray(roles) && roles.includes("admin");
                      const displayName = (user.display_name as string) || "Chưa có tên";

                      return (
                        <tr
                          key={user.id as string}
                          className="transition-colors hover:bg-gray-50"
                        >
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="flex items-center">
                              {user.avatar ? (
                                <img
                                  src={user.avatar as string}
                                  alt={displayName}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 font-medium text-white">
                                  {displayName[0]?.toUpperCase() || "?"}
                                </div>
                              )}
                              <div className="ml-3">
                                <p className="font-medium text-gray-900">{displayName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {user.email as string}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              {(user.reputation as number) || 0}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                isAdmin
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {isAdmin ? "Quản trị" : "Thành viên"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center">
                            <StatusBadge status={(user.account_status as string) || "active"} />
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500">
                            {new Date(user.created_at as string).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right">
                            {user.account_status === "active" ? (
                              <button
                                onClick={() => handleBan(user.id as string, displayName)}
                                disabled={updateMutation.isPending}
                                className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
                              >
                                Cấm
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  updateMutation.mutate({ id: user.id as string, action: "unban" })
                                }
                                disabled={updateMutation.isPending}
                                className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50"
                              >
                                Bỏ cấm
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.total > 20 && (
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-sm text-gray-700">
                  Hiển thị <span className="font-medium">{page * 20 + 1}</span> đến{" "}
                  <span className="font-medium">{Math.min((page + 1) * 20, pagination.total)}</span>{" "}
                  trong <span className="font-medium">{pagination.total}</span> người dùng
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <span className="text-sm text-gray-600">
                    Trang {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * 20 >= pagination.total}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    banned: "bg-red-100 text-red-800",
    suspended: "bg-yellow-100 text-yellow-800",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] || colors.active}`}
    >
      {status}
    </span>
  );
}
