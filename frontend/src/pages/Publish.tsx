import { useFeedbackState } from "../components/feedback";
import { Select } from "../components/Select";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { useArea } from "../app/area";
import { categories, parseId, type Category } from "../api/models";
import { errorMessage, resultUncertain } from "../api/client";
import {
  Empty,
  ErrorState,
  Gate,
  Icon,
  Intro,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { ImagePicker, type UploadImage } from "../components/ImagePicker";
import { useTask } from "../components/useTask";
export default function Publish() {
  return (
    <>
      <Intro
        title="你的私藏，值得被更多人发现。"
        subtitle="拍下眼前的美味，分享这一顿的小确幸。"
      />
      <Gate>
        <PublishForm />
      </Gate>
    </>
  );
}
function PublishForm() {
  const { api, upload, toast } = useApp(),
    [params] = useSearchParams(),
    [restaurantId, setRestaurantId] = useState(
      parseId(params.get("restaurantId") ?? undefined),
    ),
    [picker, setPicker] = useState(false),
    [images, setImages] = useState<UploadImage[]>([]),
    [done, setDone] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useFeedbackState(),
    [uncertain, setUncertain] = useState(false);
  const restaurant = useQuery({
    queryKey: ["restaurants", "detail", restaurantId],
    queryFn: () => api.restaurant(restaurantId!),
    enabled: !!restaurantId,
  });
  const cacheTask = useTask(undefined, undefined, ["foods"]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || uncertain) return;
    setError("");
    if (!restaurantId || !restaurant.data) {
      setError("请先选择一家已有餐厅。");
      return;
    }
    if (!images.length) {
      setError("请至少选择一张菜品图片。");
      return;
    }
    const data = new FormData(e.currentTarget),
      name = String(data.get("name") || "").trim(),
      priceText = String(data.get("price") || "").trim(),
      price = priceText ? Number(priceText) : undefined;
    if (!name || name.length > 64) {
      setError("请填写 1–64 字的菜品名称。");
      return;
    }
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
      setError("请填写有效的非负价格。");
      return;
    }
    setPending(true);
    let next = [...images],
      creating = false;
    try {
      for (let i = 0; i < next.length; i++) {
        if (next[i].key) continue;
        next[i] = { ...next[i], status: "uploading" };
        setImages([...next]);
        try {
          const key = await upload(next[i].file, "foods", (phase) => {
            next[i] = { ...next[i], status: phase };
            setImages([...next]);
          });
          next[i] = { ...next[i], key, status: "done" };
          setImages([...next]);
        } catch (e) {
          next[i] = { ...next[i], status: "error" };
          setImages([...next]);
          throw e;
        }
      }
      creating = true;
      await api.createFood({
        restaurantId,
        name,
        price,
        category: String(data.get("category")) as Category,
        description: String(data.get("description") || "").trim() || undefined,
        pictureUrl: next.map((i) => i.key!),
      });
      setDone(true);
      cacheTask.run(async () => null);
      toast(isDemo ? "演示分享已保存在本地" : "分享已提交");
    } catch (e) {
      setError(errorMessage(e));
      if (creating && resultUncertain(e)) setUncertain(true);
    } finally {
      setPending(false);
    }
  }
  if (done)
    return (
      <Empty
        title={
          isDemo ? "这一份好味道，已存入本地演示" : "这一份好味道，已提交成功"
        }
        action={
          <div className="center-actions">
            <Link to="/me" className="btn btn-primary">
              去我的分享
              <Icon name="arrow" />
            </Link>
            <Link
              to={`/restaurants/${restaurantId}`}
              className="btn btn-secondary"
            >
              回到这家餐厅
            </Link>
          </div>
        }
      >
        在“我的分享”中查看提交结果，再为准确条目添加个人分类。
      </Empty>
    );
  return (
    <>
      <form onSubmit={submit} className="publish-layout">
        <div className="publish-form">
          <section className="form-section">
            <div className="form-section-heading">
              <span className="step-number">1</span>
              <h2>先告诉我们，在哪里吃到的？</h2>
            </div>
            <label className="form-label">关联餐厅</label>
            <button
              className="restaurant-select"
              type="button"
              disabled={pending}
              onClick={() => setPicker(true)}
            >
              <Icon name="store" />
              {restaurant.isFetching
                ? "正在读取餐厅…"
                : restaurant.data?.name || "选择一家已有餐厅"}
              <Icon name="right" />
            </button>
            {restaurant.error && (
              <ErrorState
                error={restaurant.error}
                retry={() => void restaurant.refetch()}
              />
            )}
            <p className="section-caption">
              没有找到？<Link to="/restaurants/new">补充一家餐厅 ↗</Link>
              ，然后回到列表选择。
            </p>
          </section>
          <section className="form-section">
            <div className="form-section-heading">
              <span className="step-number">2</span>
              <h2>好味道，先让照片说话。</h2>
            </div>
            <ImagePicker
              images={images}
              onChange={setImages}
              disabled={pending}
            />
          </section>
          <section className="form-section">
            <div className="form-section-heading">
              <span className="step-number">3</span>
              <h2>给这份美味，留个小注脚。</h2>
            </div>
            <div className="field-group">
              <label className="form-label" htmlFor="publish-name">
                菜品名称
              </label>
              <input
                className="field"
                id="publish-name"
                name="name"
                maxLength={64}
                placeholder="比如：让人想再来一碗的溏心蛋拉面"
                required
                disabled={pending}
              />
            </div>
            <div className="form-two-cols">
              <div className="field-group">
                <label className="form-label" htmlFor="publish-price">
                  价格 <span className="optional">选填</span>
                </label>
                <input
                  className="field"
                  type="number"
                  id="publish-price"
                  name="price"
                  min="0"
                  step="0.01"
                  placeholder="这一份花了多少？"
                  disabled={pending}
                />
              </div>
              <div className="field-group">
                <label className="form-label" htmlFor="publish-category">
                  分类
                </label>
                <Select
                  className="field"
                  id="publish-category"
                  name="category"
                  disabled={pending}
                >
                  {categories
                    .filter((c) => c.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
            <div className="field-group">
              <label className="form-label" htmlFor="publish-description">
                想说的话 <span className="optional">选填</span>
              </label>
              <textarea
                className="field"
                id="publish-description"
                name="description"
                maxLength={2000}
                placeholder="口味、分量，或是某个值得被记住的小细节……"
                disabled={pending}
              />
            </div>

            {uncertain && (
              <div className="info-strip">
                <p>
                  提交结果暂时不确定。请先在“我的分享”中核实，避免重复发布。
                </p>
                <Link className="text-link" to="/me">
                  去核实我的分享 ↗
                </Link>
              </div>
            )}
          </section>
        </div>
        <aside className="publish-aside">
          <div className="publish-note">
            <span className="mini-spark">✳</span>
            <h2>
              你的私藏，
              <br />
              也许正是别人的
              <br />
              下一餐。
            </h2>
            <p>真实的分享，比什么都动人。</p>
            <ul>
              <li>拍下自己眼前的美味</li>
              <li>写一点真实的感受</li>
              <li>把餐厅位置选准确</li>
            </ul>
          </div>
          <div className="submit-card">
            <button className="btn btn-primary" disabled={pending || uncertain}>
              {pending ? "正在上传与提交…" : "分享这份好味道"}
              <Icon name="arrow" />
            </button>
            <p>
              {isDemo
                ? "演示模式，照片和内容仅保存在浏览器"
                : "请勿上传包含他人隐私的照片。"}
            </p>
          </div>
        </aside>
      </form>
      {picker && (
        <Modal title="这一餐，在哪里吃到的？" onClose={() => setPicker(false)}>
          <RestaurantPicker
            onSelect={(id) => {
              setRestaurantId(id);
              setPicker(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}
function RestaurantPicker({ onSelect }: { onSelect: (id: number) => void }) {
  const { api } = useApp(),
    { area, openArea } = useArea(),
    [keyword, setKeyword] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["restaurants", "picker", area, search, page],
    queryFn: () =>
      api.restaurantSearch({
        gcjLng: area!.gcjLng,
        gcjLat: area!.gcjLat,
        hubId: area?.hubId,
        keyword: search,
        page,
        pageSize: 12,
      }),
    enabled: !!area,
  });
  return (
    <>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(keyword.trim());
          setPage(1);
        }}
      >
        <input
          className="field"
          aria-label="查找关联餐厅"
          placeholder="输入餐厅名称"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button className="btn btn-primary">查找</button>
      </form>
      {!area ? (
        <button className="btn btn-secondary" onClick={openArea}>
          先选择查询区域
        </button>
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : q.data.items?.length ? (
        <div className="area-list">
          {q.data.items.map((r) => (
            <button
              className="area-option"
              key={r.id}
              disabled={!r.id}
              onClick={() => onSelect(r.id!)}
            >
              <Icon name="store" />
              <span>
                {r.name}
                <small>{r.address}</small>
              </span>
              <Icon name="check" />
            </button>
          ))}
        </div>
      ) : (
        <p className="muted modal-description">
          还没有找到餐厅，试试其他关键词或区域。
        </p>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
    </>
  );
}
export function NewRestaurant() {
  return (
    <>
      <Intro
        title="把一家好店，加入校园地图。"
        subtitle="补充准确的名称、地址和位置，方便同学找到它。"
      />
      <Gate>
        <NewRestaurantForm />
      </Gate>
    </>
  );
}
function NewRestaurantForm() {
  const { api } = useApp(),
    { area, openArea } = useArea(),
    [done, setDone] = useState(false);
  const task = useTask("餐厅已提交", () => setDone(true), ["restaurants"]);
  if (done)
    return (
      <Empty
        title="这家餐厅，已提交成功"
        action={
          <Link to="/restaurants" className="btn btn-primary">
            回列表重新查找
            <Icon name="arrow" />
          </Link>
        }
      >
        回到餐厅列表，查找并选择准确的餐厅后，再分享菜品。
      </Empty>
    );
  return (
    <form
      className="settings-card narrow-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        task.run(async () => {
          const gcjLng = Number(d.get("lng")),
            gcjLat = Number(d.get("lat"));
          if (!Number.isFinite(gcjLng) || !Number.isFinite(gcjLat))
            throw new Error("请填写有效坐标。");
          await api.createRestaurant({
            name: String(d.get("name")).trim(),
            address: String(d.get("address")).trim(),
            gcjLng,
            gcjLat,
            hubId: area?.hubId,
          });
        });
      }}
    >
      <label className="form-label" htmlFor="store-name">
        餐厅名称
      </label>
      <input
        className="field"
        id="store-name"
        name="name"
        maxLength={128}
        required
      />
      <label className="form-label" htmlFor="store-address">
        详细地址
      </label>
      <input
        className="field"
        id="store-address"
        name="address"
        maxLength={255}
        required
      />
      <div className="form-two-cols">
        <div>
          <label className="form-label" htmlFor="store-lng">
            GCJ02 经度
          </label>
          <input
            className="field"
            id="store-lng"
            name="lng"
            type="number"
            min="72.004"
            max="137.8347"
            step="any"
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor="store-lat">
            GCJ02 纬度
          </label>
          <input
            className="field"
            id="store-lat"
            name="lat"
            type="number"
            min="0.8293"
            max="55.8271"
            step="any"
            required
          />
        </div>
      </div>
      <p className="section-caption">
        请填写餐厅的准确坐标，所选区域中心不作为餐厅实际位置。
      </p>
      <button type="button" className="text-link" onClick={openArea}>
        <Icon name="pin" />
        {area?.name || "选择所属查询区域（可选）"}
      </button>
      {task.error && <ErrorState error={task.error} />}
      {resultUncertain(task.error) && (
        <div className="info-strip">
          <p>提交结果暂不确定，请先回餐厅列表核实，避免重复添加。</p>
          <Link className="text-link" to="/restaurants">
            去核实餐厅 ↗
          </Link>
        </div>
      )}
      <button
        className="btn btn-primary"
        disabled={task.isPending || resultUncertain(task.error)}
      >
        提交餐厅
        <Icon name="arrow" />
      </button>
    </form>
  );
}
