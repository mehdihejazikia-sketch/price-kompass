"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/client";
import type { ServerSourceInfo, CheckProduct } from "@/lib/sources";
import type { StoredCheck } from "@/lib/server/prices";
import { PriceChecker } from "./PriceChecker";
import { PriceChart, type HistoryPoint } from "./PriceChart";

export function ProductPrices(props: { product: CheckProduct; initialLast: StoredCheck[]; initialHistory: HistoryPoint[]; serverSources: ServerSourceInfo[] }) {
  const [history, setHistory] = useState(props.initialHistory);
  const reload = useCallback(() => {
    apiFetch<{ history: HistoryPoint[] }>(`/api/products/${props.product.id}/prices`).then((d) => setHistory(d.history)).catch(() => {});
  }, [props.product.id]);
  return (
    <>
      <PriceChecker product={props.product} initialLast={props.initialLast} serverSources={props.serverSources} onSaved={reload} />
      <PriceChart history={history} />
    </>
  );
}
