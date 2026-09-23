import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, LoaderCircle, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { hasRole, useProfile } from "@/hooks/useProfile";
import { createProduct, deleteProduct, listProducts } from "@/lib/market.functions";
import { resizeImage } from "@/lib/photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({
    meta: [
      { title: "Маркет — TAZA KÖZ" },
      { name: "description", content: "Товары TAZA KÖZ: экотовары и мерч платформы мониторинга водоёмов Мангистау и Каспия." },
      { property: "og:title", content: "Маркет — TAZA KÖZ" },
      { property: "og:description", content: "Каталог товаров TAZA KÖZ с фото и описанием." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const { data: me } = useProfile();
  const isAdmin = hasRole(me?.roles, "admin");
  const fetchProducts = useServerFn(listProducts);
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(),
    staleTime: 30_000,
  });

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-28">
      <header className="flex items-center gap-2">
        <ShoppingBag className="size-5 text-primary" strokeWidth={1.7} />
        <h1 className="text-xl font-semibold">Маркет</h1>
      </header>

      {isAdmin ? <ProductForm /> : null}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-6 animate-spin text-primary" />
        </div>
      ) : (products ?? []).length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          Пока нет товаров. Загляните позже.
        </p>
      ) : (
        <ul className="space-y-4">
          {(products ?? []).map((p) => (
            <ProductCard key={p.id} product={p} isAdmin={isAdmin} />
          ))}
        </ul>
      )}
    </main>
  );
}

type Product = {
  id: string;
  title: string;
  description: string;
  price_kzt: number;
  photo: string | null;
};

function ProductCard({ product, isAdmin }: { product: Product; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const remove = useServerFn(deleteProduct);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <li className="relative overflow-hidden rounded-2xl bg-card shadow-sm">
      {product.photo ? (
        <img
          src={product.photo}
          alt={product.title}
          loading="lazy"
          className="h-52 w-full object-cover"
        />
      ) : null}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{product.title}</h2>
          {product.price_kzt > 0 ? (
            <span className="shrink-0 text-sm font-semibold text-primary">
              {product.price_kzt.toLocaleString("ru-RU")} ₸
            </span>
          ) : null}
        </div>
        {product.description ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">{product.description}</p>
        ) : null}
        <Button className="w-full rounded-xl" asChild>
          <a
            href={`https://wa.me/77764694462?text=${encodeURIComponent(
              "Здравствуйте! Я бы хотел приобрести этот товар от TazaKoz и быть экологически чистым.",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Заказать
          </a>
        </Button>
      </div>

      {isAdmin ? (
        <button
          type="button"
          aria-label="Удалить товар"
          onClick={() => setConfirm(true)}
          className="absolute right-3 top-3 rounded-full bg-card/90 p-2 text-destructive shadow-sm"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}

      {confirm ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-destructive/90 p-6 text-center text-destructive-foreground">
          <p className="text-sm font-medium">Удалить товар из маркета?</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => setConfirm(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await remove({ data: { productId: product.id } });
                  await queryClient.invalidateQueries({ queryKey: ["products"] });
                  toast.success("Товар удалён");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Не удалось удалить");
                } finally {
                  setBusy(false);
                  setConfirm(false);
                }
              }}
            >
              Удалить
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ProductForm() {
  const queryClient = useQueryClient();
  const create = useServerFn(createProduct);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const { dataUrl } = await resizeImage(file, 1080);
      setPhoto(dataUrl);
    } catch {
      toast.error("Не удалось обработать фото");
    }
  }

  async function submit() {
    if (title.trim().length < 2) {
      toast.error("Укажите название товара");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          title: title.trim(),
          description: description.trim(),
          priceKzt: Number(price) || 0,
          photoDataUrl: photo,
        },
      });
      setTitle("");
      setDescription("");
      setPrice("");
      setPhoto("");
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Товар опубликован");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось опубликовать");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Новый товар</h2>
      <Input placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <Textarea
        placeholder="Описание"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={2000}
        rows={4}
      />
      <Input
        placeholder="Цена, ₸"
        inputMode="numeric"
        value={price}
        onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
      />
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
        <ImagePlus className="size-5" />
        {photo ? "Фото выбрано — заменить" : "Добавить фото"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      {photo ? <img src={photo} alt="Предпросмотр товара" className="h-40 w-full rounded-xl object-cover" /> : null}
      <Button className="w-full rounded-xl" disabled={busy} onClick={submit}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : "Опубликовать"}
      </Button>
    </section>
  );
}
