import "./styles.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { aplicarTemaSalvo } from "@/lib/theme";
import { instalarAvisoDeVersao } from "@/lib/version";

import { criarQueryClient, criarRoteador } from "./router";

const queryClient = criarQueryClient(() => {
  const { pathname, search } = window.location;
  if (pathname === "/login") return;
  queryClient.clear();
  void roteador.navigate({
    to: "/login",
    search: { redirect: `${pathname}${search}` },
  });
});
const roteador = criarRoteador(queryClient);
aplicarTemaSalvo();
instalarAvisoDeVersao();

const raiz = document.getElementById("app");
if (!raiz) throw new Error("index.html sem o elemento #app");

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>
  </StrictMode>,
);
