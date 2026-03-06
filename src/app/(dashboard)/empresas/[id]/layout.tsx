"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useClient } from "@/contexts/client-context";

export default function EmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const clientId = params?.id as string | undefined;
  const { setSelectedClientId } = useClient();

  useEffect(() => {
    if (clientId) {
      setSelectedClientId(clientId);
    }
  }, [clientId, setSelectedClientId]);

  return <>{children}</>;
}
