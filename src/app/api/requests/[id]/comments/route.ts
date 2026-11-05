import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import {
  isWithinAdminReopenWindow,
  isUserClosedArchiveDue,
  LIFECYCLE_CONFIG,
} from "@/config/lifecycle";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const {
      message = "",
      token,
      isInternalStaffOnly = false,
      attachments = [],
    } = await req.json();

    const cleanMessage = (message || "").trim();
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    if (!cleanMessage && !hasAttachments) {
      return NextResponse.json(
        { success: false, error: "Please provide a message or attach a photo." },
        { status: 400 }
      );
    }

    const request = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: params.id }, { ticketNumber: params.id }],
      },
    });

    if (!request) {
      return NextResponse.json(
        { success: false, error: "Request not found." },
        { status: 404 }
      );
    }

    const currentUser = await getCurrentUser();
    const isAuthorizedRequester = token && request.trackingToken === token;

    if (!currentUser && !isAuthorizedRequester) {
      return NextResponse.json(
        { success: false, error: "Unauthorized to comment on this request." },
        { status: 401 }
      );
    }

    // Photo uploads are strictly forbidden for unauthenticated / guest users
    if (!currentUser && hasAttachments) {
      return NextResponse.json(
        {
          success: false,
          error: "Photo attachments are not allowed for guest users. Please sign in with your IITGN account to attach photos.",
        },
        { status: 403 }
      );
    }

    let authorName = request.requesterName;
    let authorRole = "requester";
    let authorUserId: string | null = null;
    let updatedStatus = request.status;

    if (currentUser) {
      authorName = currentUser.name;
      authorRole =
        currentUser.roleCode === "OVERALL_ADMIN"
          ? "admin"
          : currentUser.roleCode === "DEPT_ADMIN" ||
            currentUser.roleCode === "DEPT_STAFF"
          ? "staff"
          : "resident";
      authorUserId = currentUser.id;
    } else if (isAuthorizedRequester) {
      // Requester replying!
      if (request.status === "CLOSED") {
        if (!isWithinAdminReopenWindow(request.closedAt)) {
          return NextResponse.json(
            {
              success: false,
              error: `The 3-day grace window to reopen this closed ticket has expired. This complaint has been transferred to archival storage.`,
            },
            { status: 403 }
          );
        }
      }

      // If ticket was RESOLVED or CLOSED, automatically move it back to IN_PROGRESS!
      if (request.status === "RESOLVED" || request.status === "CLOSED") {
        updatedStatus = "IN_PROGRESS";
        await prisma.maintenanceRequest.update({
          where: { id: request.id },
          data: {
            status: "IN_PROGRESS",
            reopenCount: { increment: 1 },
            reopenReason: `Reopened via resident update: "${cleanMessage.slice(0, 100)}"`,
            closedAt: null,
            closedByRole: null,
            updatedAt: new Date(),
          },
        });

        await prisma.statusEvent.create({
          data: {
            requestId: request.id,
            performedByName: request.requesterName,
            eventType: "STATUS_CHANGE",
            fromStatus: request.status,
            toStatus: "IN_PROGRESS",
            note: `Complaint automatically moved back to IN_PROGRESS via resident follow-up update.`,
          },
        });
      }
    }

    // Save attached photos to the request
    if (hasAttachments) {
      for (const att of attachments) {
        if (att.url && att.name) {
          await prisma.attachment.create({
            data: {
              requestId: request.id,
              url: att.url,
              originalName: att.name,
              mimeType: att.type || "image/jpeg",
              sizeBytes: att.size || 1024,
              isAfterPhoto: currentUser?.roleCode === "DEPT_STAFF",
            },
          });
        }
      }
    }

    // Compose final message text (appending inline attachment tags if needed)
    let finalMessageText = cleanMessage;
    if (hasAttachments) {
      const attTags = attachments
        .filter((a: any) => a.url)
        .map((a: any) => `[ATTACHMENT_IMG:${a.url}|${encodeURIComponent(a.name || "photo.jpg")}]`)
        .join(" ");
      finalMessageText = finalMessageText ? `${finalMessageText}\n${attTags}` : attTags;
    }

    const comment = await prisma.followUpComment.create({
      data: {
        requestId: request.id,
        authorName,
        authorRole,
        authorUserId,
        isInternalStaffOnly: Boolean(isInternalStaffOnly && currentUser),
        message: finalMessageText || "Attached photo update",
      },
    });

    return NextResponse.json({
      success: true,
      comment,
      status: updatedStatus,
      reopened: updatedStatus !== request.status,
      message:
        updatedStatus !== request.status
          ? `Your message was posted and this complaint was moved back to IN_PROGRESS.`
          : `Update posted successfully.`,
    });
  } catch (error) {
    console.error("Comment posting error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to post comment." },
      { status: 500 }
    );
  }
}
