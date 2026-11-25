import { Select } from "../../components/Select";
import { useApp } from "../../app/state";
import { foodEditBody } from "../../api/content-rules";
import { categories, type Food, type Schema } from "../../api/models";
import { useTask } from "../../components/useTask";
import { Drawer, Field, Thumb } from "../kit";

/** Edits the basic information of a dish. */
export function FoodEditor({ food, onClose }: { food: Food; onClose: () => void }) {
  const { api, toast } = useApp(),
    task = useTask(undefined, onClose, ["foods", "admin"]);
  return (
    <Drawer
      title="编辑菜品"
      subtitle={`#${food.id} · ${food.restaurantName || "未关联餐厅"}`}
      onClose={onClose}
      onSubmit={(e) => {
        const d = new FormData(e.currentTarget);
        task.run(async () => {
          const result = await api.editFood(
            food.id!,
            foodEditBody(food, {
              name: String(d.get("name")).trim(),
              description: String(d.get("description") || ""),
              price: d.get("price") === "" ? undefined : Number(d.get("price")),
              category: String(
                d.get("category"),
              ) as Schema["EditFoodDTORequest"]["category"],
            }),
          );
          toast(result?.moderationStatus === "PENDING" ? "修改已提交审核。" : "菜品资料已更新。", {
            tone: "success",
          });
        });
      }}
      footer={
        <>
          <button type="button" className="ew-admin-btn" onClick={onClose}>
            取消
          </button>
          <button className="ew-admin-btn is-primary" disabled={task.isPending}>
            {task.isPending ? "保存中…" : "保存"}
          </button>
        </>
      }
    >
      {!!food.pictureUrl?.length && (
        <div className="ew-admin-gallery">
          {food.pictureUrl.slice(0, 4).map((src) => (
            <Thumb key={src} src={src} />
          ))}
        </div>
      )}
      <div className="ew-admin-form">
        <Field label="菜品名称" wide>
          <input name="name" defaultValue={food.name || ""} required />
        </Field>
        <Field label="价格（元）">
          <input
            name="price"
            type="number"
            min="0"
            step="any"
            defaultValue={food.price ?? ""}
          />
        </Field>
        <Field label="基础分类">
          <Select inline motionDuration={200} closeDuration={100} name="category" defaultValue={food.category || "other"}>
            {categories
              .filter((c) => c.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="描述" wide>
          <textarea
            name="description"
            rows={5}
            defaultValue={food.description || ""}
          />
        </Field>
      </div>
    </Drawer>
  );
}
