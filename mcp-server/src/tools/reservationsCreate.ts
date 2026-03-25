import { z } from "zod";
import { getDb } from "../mongo.js";
import { ObjectId } from "mongodb";

export const ReservationsCreateInput = z.object({
  chaletId: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestName: z.string(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).optional()
});

export type ReservationsCreateArgs = z.infer<typeof ReservationsCreateInput>;

function toDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export async function reservationsCreate(args: ReservationsCreateArgs) {
  const db = await getDb();
  const collection = db.collection("reservations");

  const existing = await collection
    .find({ chaletId: args.chaletId, status: { $ne: "CANCELED" } })
    .toArray();

  const aStart = toDate(args.checkIn);
  const aEnd = toDate(args.checkOut);

  for (const res of existing) {
    const bStart = toDate(String(res.checkIn));
    const bEnd = toDate(String(res.checkOut));

    if (overlaps(aStart, aEnd, bStart, bEnd)) {
      return {
        ok: false,
        error: "CONFLICT",
        conflict: {
          reservationId: String(res._id),
          checkIn: String(res.checkIn),
          checkOut: String(res.checkOut),
          guestName: String(res.guestName)
        }
      };
    }
  }

  const doc = {
    chaletId: args.chaletId,
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    guestName: args.guestName,
    arrivalTime: args.arrivalTime ?? null,
    status: "CONFIRMED",
    createdAt: new Date().toISOString()
  };

  const result = await collection.insertOne(doc);

  return {
    ok: true,
    reservationId: String(result.insertedId),
    ...doc
  };
}

export const _internal = { overlaps };
