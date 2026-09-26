import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { addContact, deleteContact, getSchool, supabaseConfigured, updateContact } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
  }
  try {
    const school = await addContact(id, body);
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "create",
      entityType: "school",
      entityId: school.id,
      summary: `Added contact “${body.name.trim()}” on “${school.name}”`,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add contact";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as {
    contactId?: string;
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
  };
  if (!body.contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }
  try {
    const before = await getSchool(id);
    const prior = before.contacts.find((contact) => contact.id === body.contactId);
    const school = await updateContact(id, body.contactId, body);
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "update",
      entityType: "school",
      entityId: school.id,
      summary: `Updated contact “${prior?.name ?? body.name ?? "contact"}” on “${school.name}”`,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update contact";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const contactId = new URL(request.url).searchParams.get("contactId");
  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }
  try {
    const before = await getSchool(id);
    const prior = before.contacts.find((contact) => contact.id === contactId);
    const school = await deleteContact(id, contactId);
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "delete",
      entityType: "school",
      entityId: school.id,
      summary: `Removed contact “${prior?.name ?? "contact"}” on “${school.name}”`,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete contact";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
