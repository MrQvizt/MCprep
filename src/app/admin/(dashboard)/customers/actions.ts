"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, fdString, handleActionError, ok, type ActionState } from "@/lib/actions";
import { anonymizeCustomer, setCustomerManualStatus, updateCustomerNotes, withdrawMarketingConsent } from "@/lib/admin/customers";
import { adminCreatePasswordResetLink, adminDeleteWebsiteAccount } from "@/lib/admin/customer-accounts";
import { OrderActionError } from "@/lib/admin/orders";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";

function refresh(customerId: string) {
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

function customerError(error: unknown): ActionState<never> {
  if (error instanceof OrderActionError) return fail(error.message);
  return handleActionError(error);
}

const statusSchema = z.object({ manualStatus: z.enum(["AUTO", "FIRST_TIME", "EXISTING"]) });

export async function setCustomerStatusAction(customerId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.customers);
    const { manualStatus } = statusSchema.parse({ manualStatus: fdString(fd, "manualStatus") });
    await setCustomerManualStatus({ customerId, status: manualStatus === "AUTO" ? null : manualStatus, actor: admin });
    refresh(customerId);
    return ok("Customer status saved");
  } catch (error) {
    return customerError(error);
  }
}

const notesSchema = z.object({ notes: z.string().max(4000, "Keep notes under 4,000 characters.") });

export async function saveCustomerNotesAction(customerId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.customers);
    const { notes } = notesSchema.parse({ notes: fdString(fd, "notes") });
    await updateCustomerNotes({ customerId, notes, actor: admin });
    refresh(customerId);
    return ok("Notes saved");
  } catch (error) {
    return customerError(error);
  }
}

export async function withdrawConsentAction(customerId: string, consentId: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.customers);
    await withdrawMarketingConsent({ consentId, actor: admin });
    refresh(customerId);
    return ok("Marketing consent withdrawn");
  } catch (error) {
    return customerError(error);
  }
}

export async function anonymizeCustomerAction(customerId: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.customers);
    await anonymizeCustomer({ customerId, actor: admin });
    refresh(customerId);
    revalidatePath("/admin/orders");
  } catch (error) {
    return customerError(error);
  }
  redirect(`/admin/customers/${customerId}?anonymised=1`);
}

export async function createAccountResetLinkAction(customerId: string, accountId: string): Promise<ActionState<{ url: string }>> {
  try {
    const admin = await assertAdmin(AREA_ROLES.customers);
    const url = await adminCreatePasswordResetLink({ accountId, customerId, actor: admin });
    refresh(customerId);
    return ok("Reset link created", { url });
  } catch (error) {
    return customerError(error);
  }
}

export async function deleteWebsiteAccountAction(customerId: string, accountId: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.customers);
    await adminDeleteWebsiteAccount({ accountId, customerId, actor: admin });
    refresh(customerId);
    return ok("Website account deleted");
  } catch (error) {
    return customerError(error);
  }
}
