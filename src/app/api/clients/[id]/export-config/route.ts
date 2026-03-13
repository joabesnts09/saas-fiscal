import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";
import { DEFAULT_EXPORT_FIELDS, EXPORT_FIELD_KEYS, type ExportFieldKey } from "@/lib/export-config";

async function verifyClientAccess(clientId: string, accountId: string) {
  return prisma.client.findFirst({ where: { id: clientId, accountId } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(_request);
    const accountId = auth?.accountId;
    if (!accountId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const config = await prisma.exportConfig.findUnique({
      where: { clientId },
    });

    let fields: string[] = config?.fieldsJson
      ? (JSON.parse(config.fieldsJson) as string[])
      : [...DEFAULT_EXPORT_FIELDS];

    // Migrar emitenteDestinatario antigo para emitente + destinatario
    const migrated: string[] = [];
    for (const f of fields) {
      if (f === "emitenteDestinatario") {
        if (!migrated.includes("emitente")) migrated.push("emitente");
        if (!migrated.includes("destinatario")) migrated.push("destinatario");
      } else {
        migrated.push(f);
      }
    }
    fields = migrated;

    // Garantir emitente e destinatario em configs antigos (inserir após chave)
    const requiredFields = ["emitente", "destinatario"] as const;
    for (const rf of requiredFields) {
      if (!fields.includes(rf)) {
        const chaveIdx = fields.indexOf("chave");
        const insertAt = chaveIdx >= 0 ? chaveIdx + 1 : 0;
        fields.splice(insertAt, 0, rf);
      }
    }

    const validSet = new Set(EXPORT_FIELD_KEYS as unknown as string[]);
    const validFields = fields.filter((f) => typeof f === "string" && validSet.has(f)) as ExportFieldKey[];
    const finalFields =
      validFields.length > 0 ? validFields : ([...DEFAULT_EXPORT_FIELDS] as ExportFieldKey[]);

    return NextResponse.json({ fields: finalFields });
  } catch (error) {
    console.error("Export config GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar configuração" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const body = await request.json();
    const fields = body?.fields;
    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json({ error: "Campo 'fields' (array) obrigatório" }, { status: 400 });
    }

    const validKeys = new Set(EXPORT_FIELD_KEYS as unknown as string[]);
    const sanitized = fields.filter((f: string) => typeof f === "string" && validKeys.has(f));

    await prisma.exportConfig.upsert({
      where: { clientId },
      create: { clientId, fieldsJson: JSON.stringify(sanitized) },
      update: { fieldsJson: JSON.stringify(sanitized) },
    });

    return NextResponse.json({ fields: sanitized });
  } catch (error) {
    console.error("Export config PATCH error:", error);
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 });
  }
}
