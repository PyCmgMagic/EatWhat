import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { expect, it } from "vitest";
import { createApi } from "./service";
import type { RequestOptions } from "./client";
// Read the only authoritative specification, including its unusual /api controller prefix.
const spec = parse(
  readFileSync(
    new URL("../../../docs/吃什么接口文档v2-openapi.yaml", import.meta.url),
    "utf8",
  ),
);
it("every implemented service operation exists in v2 and supplies its required parameters", async () => {
  const calls: { path: string; options: RequestOptions }[] = [];
  const api = createApi(async (path, options) => {
    calls.push({ path, options });
    return { code: 0, data: {} };
  });
  await Promise.all([
    api.login({ username: "abc", password: "123456", device: "WEB" }),
    api.register({ username: "abc", password: "123456", device: "WEB" }),
    api.checkUsername("abc"),
    api.logout(),
    api.me(),
    api.updateProfile({ userName: "abc" }),
    api.changePassword({ oldPassword: "a", newPassword: "123456" }),
    api.privacy({ following: true }),
    api.verified(),
    api.sendEmail("x@x.edu"),
    api.consentPolicy(),
    api.consent(),
    api.grantConsent({ policyVersion: "v1", proof: "proof" }),
    api.withdrawConsent(),
    api.recommend(),
    api.food(1),
    api.foods(1),
    api.myFoods(),
    api.favorites(),
    api.like(1, false),
    api.like(1, true),
    api.favorite(1, false),
    api.favorite(1, true),
    api.foodTags(1),
    api.myTags(),
    api.systemTags(),
    api.addCustomTags(1, ["want"]),
    api.addSystemTags(1, [2]),
    api.removeTag(1, 2),
    api.renameTag(2, "want"),
    api.deleteTag(2),
    api.createFood({ restaurantId: 1, name: "面", pictureUrl: ["k"] }),
    api.hubs(),
    api.restaurantSearch({ gcjLng: 117, gcjLat: 36 }),
    api.restaurant(1),
    api.createRestaurant({
      name: "店",
      address: "地址",
      gcjLng: 117,
      gcjLat: 36,
    }),
    api.presign({
      fileName: "x.jpg",
      contentType: "image/jpeg",
      fileSize: 1,
      biz: "foods",
    }),
    api.complete("k"),
    api.notifications(),
    api.unread(),
    api.read(1),
    api.readAll(),
    api.history("food"),
    api.otherUser(2),
    api.follow(2, true),
    api.follow(2, false),
    api.followers("followers"),
    api.followers("followings"),
    api.provinces(),
    api.cities(1),
    api.sendMobileCode("13800000000"),
    api.bindMobile("13800000000", "123456"),
    api.summary(),
    api.adminRestaurants(),
    api.editRestaurant(1, { name: "店" }),
    api.deleteRestaurant(1),
    api.editFood(1, { name: "面" }),
    api.deleteFood(1),
    api.adminTags(),
    api.createSystemTag("tag"),
    api.editSystemTag(1, "tag"),
    api.deleteSystemTag(1),
    api.adminUsers(),
    api.ban(1, "reason"),
    api.unban(1),
    api.createHub({ name: "校区", gcjLng: 117, gcjLat: 36 }),
    api.editHub(1, { name: "校区", gcjLng: 117, gcjLat: 36 }),
    api.deleteHub(1),
    api.rebindHub(1),
  ]);
  for (const { path, options } of calls) {
    const matched = Object.keys(spec.paths).find((template) =>
      new RegExp("^" + template.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(
        path,
      ),
    );
    expect(matched, `undefined endpoint ${path}`).toBeTruthy();
    const method = (options.method ?? "GET").toLowerCase();
    const op = spec.paths[matched!][method];
    expect(op, `${method} ${path} missing from v2`).toBeTruthy();
    for (const param of op.parameters ?? [])
      if (param.required && param.in === "query")
        expect(
          options.query?.[param.name],
          `${path} requires ${param.name}`,
        ).not.toBeUndefined();
    if (op.requestBody?.required) {
      expect(options.body, `${path} requires a body`).toBeDefined();
      const schema = op.requestBody.content["application/json"]?.schema;
      if (schema?.$ref) {
        const bodySchema =
          spec.components.schemas[schema.$ref.split("/").pop()];
        for (const key of bodySchema.required ?? [])
          expect(
            (options.body as Record<string, unknown>)[key],
            `${path} requires body.${key}`,
          ).not.toBeUndefined();
      }
    }
  }
  expect(calls).toHaveLength(69);
});
