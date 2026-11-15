import type { Schema, User } from "../api/models";

export const PROFILE_SIGNATURE_LIMIT = 100;

export type ProfileForm = {
  name: string;
  signature: string;
  gender: string;
  // Unknown saved birthday formats stay untouched until explicitly changed.
  birthday: string | undefined;
  province: number | null;
  city: number | null;
};
export function profileForm(user: User): ProfileForm {
  const date = user.birthday;
  return {
    name: user.displayName ?? "",
    signature: user.signature ?? "",
    gender: user.gender ?? "",
    birthday:
      date == null || date === ""
        ? ""
        : typeof date === "string" && /^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(date)
          ? date.slice(0, 10)
          : undefined,
    province: user.hometownProvinceId ?? null,
    city: user.hometownCityId ?? null,
  };
}
export function profileChanges(form: ProfileForm, saved: ProfileForm) {
  const body: Schema["UpdateUserInfoDTORequest"] = {};
  if (form.name.trim() !== saved.name.trim())
    body.displayName = form.name.trim();
  if (form.signature !== saved.signature) body.signature = form.signature;
  if (form.gender !== saved.gender && form.gender) body.gender = form.gender;
  if (form.birthday !== saved.birthday && form.birthday !== undefined)
    body.birthday = form.birthday || undefined;
  if (form.province !== saved.province && form.province)
    body.hometownProvinceId = form.province;
  if (form.city !== saved.city && form.city) body.hometownCityId = form.city;
  return body;
}
export function profileClearError(form: ProfileForm, saved: ProfileForm) {
  return (saved.gender && !form.gender) ||
    (saved.birthday !== "" && form.birthday === "") ||
    (saved.province && !form.province) ||
    (saved.city && !form.city)
    ? "暂不支持清空已填写的资料，请填写内容或取消本次修改。"
    : "";
}
