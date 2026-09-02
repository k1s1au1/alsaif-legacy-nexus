import { registerPlugin, Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export interface BiometricAuthPlugin {
  checkBiometry(): Promise<{ isAvailable: boolean }>;
  authenticate(options: { title: string; subtitle: string }): Promise<{ success: boolean }>;
}

export interface FamilySharingPlugin {
  shareInvitation(options: FamilyInvitationShareOptions): Promise<void>;
  shareImage(options: { base64Data: string }): Promise<void>;
}

export type FamilyInvitationShareLayout = {
  occasionType: string;
  heading: string;
  body: string;
  name?: string;
  eventDate?: string;
  time?: string;
  location?: string;
  age?: number | null;
  showLogo?: boolean;
  inviteMode?: "public" | "private";
  guestName?: string;
  groomFamily?: string;
  brideFamily?: string;
  groomName?: string;
  brideName?: string;
  venue?: string;
  city?: string;
  groomFather?: string;
  brideFather?: string;
  dayName?: string;
  hijriDate?: string;
};

export type FamilyInvitationShareOptions = {
  title: string;
  date: string;
  location: string;
  templatePath?: string;
  layout?: FamilyInvitationShareLayout;
};

export interface FamilyContactsPlugin {
  saveContact(options: { name: string; phone: string; prefix?: string }): Promise<void>;
}

export interface DocumentScannerPlugin {
  scanDocument(): Promise<{ path: string }>;
}

export interface WidgetPlugin {
  updateData(options: { title?: string; date?: string; label?: string }): Promise<void>;
}

export const DocumentScanner = registerPlugin<DocumentScannerPlugin>("DocumentScanner");
export const Widget = registerPlugin<WidgetPlugin>("Widget");

const FamilySharingRaw = registerPlugin<FamilySharingPlugin>("FamilySharing");
export const FamilyContacts = registerPlugin<FamilyContactsPlugin>("FamilyContacts");

type InvitationTextBlock = {
  text: string;
  size: number;
  lineHeight: number;
  weight: number;
  marginTop?: number;
  maxWidth?: number;
  color?: string;
  pill?: boolean;
};

const INVITATION_FONT = '"Tajawal", "Noto Sans Arabic", Arial, sans-serif';

function setInvitationFont(ctx: CanvasRenderingContext2D, block: InvitationTextBlock, scale: number) {
  ctx.font = `${block.weight} ${Math.round(block.size * scale)}px ${INVITATION_FONT}`;
}

function breakLongInvitationWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
) {
  const pieces: string[] = [];
  let piece = "";

  for (const character of Array.from(word)) {
    const next = `${piece}${character}`;
    if (piece && ctx.measureText(next).width > maxWidth) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = next;
    }
  }

  if (piece) pieces.push(piece);
  return pieces;
}

function wrapInvitationText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;

    let line = "";
    for (const originalWord of words) {
      const wordParts =
        ctx.measureText(originalWord).width > maxWidth
          ? breakLongInvitationWord(ctx, originalWord, maxWidth)
          : [originalWord];

      for (const word of wordParts) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

function drawRoundedInvitationRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function invitationBlocks(layout: FamilyInvitationShareLayout): InvitationTextBlock[] {
  const darkText = layout.occasionType === "condolence" ? "#FFFFFF" : "#183f36";
  const accentText = layout.occasionType === "condolence" ? "#FFFFFF" : "#0F5A3A";
  const blocks: InvitationTextBlock[] = [
    {
      text: layout.heading,
      size: 64,
      lineHeight: 78,
      weight: 900,
      color: darkText,
    },
  ];
  const bodyParts = layout.body.split("\n").map((part) => part.trim()).filter(Boolean);
  const guestInsertIndex = Math.min(1, Math.max(0, bodyParts.length - 1));

  bodyParts.forEach((part, index) => {
    blocks.push({
      text: part,
      size: index === 0 ? 34 : 30,
      lineHeight: index === 0 ? 51 : 48,
      weight: index < 2 ? 800 : 600,
      marginTop: index === 0 ? 24 : 12,
      maxWidth: index === 1 ? 900 : 940,
      color: darkText,
    });

    if (
      index === guestInsertIndex &&
      layout.inviteMode === "private" &&
      layout.guestName?.trim()
    ) {
      blocks.push({
        text: `المكرم/ ${layout.guestName.trim()}`,
        size: 38,
        lineHeight: 54,
        weight: 900,
        marginTop: 24,
        color: darkText,
      });
    }
  });

  if (layout.occasionType === "wedding") {
    if (layout.groomFamily?.trim() && layout.brideFamily?.trim()) {
      blocks.push({
        text: `تتشرف عائلتا ${layout.groomFamily.trim()} و ${layout.brideFamily.trim()}\nبدعوتكم لحضور حفل زواج`,
        size: 32,
        lineHeight: 49,
        weight: 900,
        marginTop: 20,
        color: darkText,
      });
    }

    const weddingNames = [layout.groomName?.trim() || layout.name?.trim(), layout.brideName?.trim()]
      .filter(Boolean)
      .join(" و ");
    if (weddingNames) {
      blocks.push({
        text: weddingNames,
        size: 58,
        lineHeight: 72,
        weight: 900,
        marginTop: 14,
        color: accentText,
      });
    }
  } else if (layout.name?.trim()) {
    blocks.push({
      text: layout.name.trim(),
      size: 58,
      lineHeight: 72,
      weight: 900,
      marginTop: 20,
      color: accentText,
    });
  }

  if (layout.occasionType === "birthday" && layout.age !== null && layout.age !== undefined) {
    blocks.push({
      text: `${layout.age} عامًا`,
      size: 76,
      lineHeight: 88,
      weight: 900,
      marginTop: 14,
      color: darkText,
    });
  }

  const dateDetails = [layout.eventDate?.trim(), layout.hijriDate?.trim(), layout.time?.trim()]
    .filter(Boolean)
    .join(" • ");
  const dateText = [layout.dayName?.trim(), dateDetails].filter(Boolean).join("\n");
  if (dateText) {
    blocks.push({
      text: dateText,
      size: 31,
      lineHeight: 45,
      weight: 900,
      marginTop: 26,
      maxWidth: 840,
      color: darkText,
      pill: true,
    });
  }

  const venue = layout.venue?.trim() || layout.location?.trim();
  const locationText = [venue, layout.city?.trim()].filter(Boolean).join(" — ");
  if (locationText) {
    blocks.push({
      text: locationText,
      size: 31,
      lineHeight: 46,
      weight: 900,
      marginTop: 20,
      maxWidth: 880,
      color: darkText,
    });
  }

  if (layout.occasionType === "wedding" && (layout.groomFather?.trim() || layout.brideFather?.trim())) {
    const parents = [
      "الداعيان",
      layout.groomFather?.trim() ? `والد العريس: ${layout.groomFather.trim()}` : "",
      layout.brideFather?.trim() ? `والد العروس: ${layout.brideFather.trim()}` : "",
    ].filter(Boolean);
    blocks.push({
      text: parents.join("\n"),
      size: 27,
      lineHeight: 42,
      weight: 800,
      marginTop: 22,
      maxWidth: 860,
      color: darkText,
    });
  }

  return blocks;
}

function measureInvitationBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: InvitationTextBlock[],
  scale: number,
) {
  return blocks.reduce((total, block) => {
    setInvitationFont(ctx, block, scale);
    const lines = wrapInvitationText(ctx, block.text, (block.maxWidth ?? 960) * scale);
    const padding = block.pill ? 26 * scale : 0;
    return total + (block.marginTop ?? 0) * scale + lines.length * block.lineHeight * scale + padding;
  }, 0);
}

function drawInvitationLayout(
  ctx: CanvasRenderingContext2D,
  layout: FamilyInvitationShareLayout,
) {
  const blocks = invitationBlocks(layout);
  const contentTop = 360;
  const contentHeight = 1400;
  let scale = 1;
  let totalHeight = measureInvitationBlocks(ctx, blocks, scale);

  while (totalHeight > contentHeight && scale > 0.62) {
    scale = Math.max(0.62, scale - 0.04);
    totalHeight = measureInvitationBlocks(ctx, blocks, scale);
  }

  let y = contentTop + Math.max(0, (contentHeight - totalHeight) / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";

  for (const block of blocks) {
    y += (block.marginTop ?? 0) * scale;
    setInvitationFont(ctx, block, scale);
    const lines = wrapInvitationText(ctx, block.text, (block.maxWidth ?? 960) * scale);
    const lineHeight = block.lineHeight * scale;
    const verticalPadding = block.pill ? 13 * scale : 0;
    const blockHeight = lines.length * lineHeight + verticalPadding * 2;

    if (block.pill) {
      ctx.save();
      ctx.fillStyle =
        layout.occasionType === "condolence" ? "rgba(255, 255, 255, 0.10)" : "rgba(24, 63, 54, 0.07)";
      drawRoundedInvitationRect(ctx, 160, y, 880, blockHeight, 34 * scale);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = block.color ?? "#183f36";
    lines.forEach((line, index) => {
      ctx.fillText(line, 600, y + verticalPadding + lineHeight * (index + 0.5));
    });
    ctx.restore();
    y += blockHeight;
  }
}

/**
 * Enhanced Sharing: Generates a beautiful image on the fly and shares it.
 */
export const FamilySharing = {
  async shareInvitation({
    title,
    date,
    location,
    templatePath,
    layout,
  }: FamilyInvitationShareOptions) {
    /*
       Royal Update v2: Direct on Template Printing
       We now load the EXACT selected template image and draw text directly on it.
    */

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 2000; // Perfect 3:5 Aspect Ratio for Invitations
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }

    // Helper to load images
    const loadImage = (src: string) => new Promise<HTMLImageElement>((res) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => res(img);
      img.onerror = () => res(new Image());
    });

    // 1. Draw Background Template
    if (templatePath) {
      const bg = await loadImage(templatePath);
      if (bg.width > 0) {
        ctx.drawImage(bg, 0, 0, 1200, 2000);
      } else {
        // Fallback if template fails to load
        ctx.fillStyle = "#FDFCF7";
        ctx.fillRect(0, 0, 1200, 2000);
      }
    } else {
      // Default Royal Design
      const grad = ctx.createLinearGradient(0, 0, 1200, 2000);
      grad.addColorStop(0, "#FDFCF7");
      grad.addColorStop(1, "#F2F1EA");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 2000);

      ctx.strokeStyle = "#8E7745";
      ctx.lineWidth = 30;
      ctx.strokeRect(50, 50, 1100, 1900);
    }

    const shouldShowLogo = layout
      ? layout.occasionType !== "condolence" && layout.showLogo !== false
      : true;
    if (shouldShowLogo) {
      const logo = await loadImage("/logo-home.png");
      if (logo.width > 0) {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.16)";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.beginPath();
        ctx.arc(600, 160, 92, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.drawImage(logo, 522, 82, 156, 156);
      }
    }

    if (layout) {
      // Match the saved occasion preview: same copy, names, date, place and template.
      drawInvitationLayout(ctx, layout);
    } else {
      // Backward-compatible layout for any legacy caller that has not supplied occasion data.
      ctx.textAlign = "center";
      ctx.direction = "rtl";
      ctx.fillStyle = "#183f36";
      ctx.font = 'bold 90px "Amiri", serif';
      ctx.fillText("دعوة عائلية", 600, 450);

      ctx.strokeStyle = "#D4AF37";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(400, 480);
      ctx.lineTo(800, 480);
      ctx.stroke();

      ctx.fillStyle = "#064E3B";
      ctx.font = 'bold 110px "Tajawal", sans-serif';
      ctx.fillText(title, 600, 750);

      const drawSection = (label: string, value: string, y: number) => {
        ctx.fillStyle = "#8E7745";
        ctx.font = 'bold 50px "Tajawal", sans-serif';
        ctx.fillText(label, 600, y);
        ctx.fillStyle = "#1A1C1E";
        ctx.font = '800 70px "Tajawal", sans-serif';
        ctx.fillText(value, 600, y + 100);
      };

      drawSection("📅 الموعد والتاريخ", date, 1050);
      drawSection("📍 الموقع والمكان", location, 1350);
    }

    // Finalize
    const dataUrl = canvas.toDataURL("image/png");

    if (Capacitor.isNativePlatform()) {
      try {
        await FamilySharingRaw.shareImage({ base64Data: dataUrl });
        return;
      } catch (e) {
        console.error("Native share failed", e);
        toast.error("تعذر فتح نافذة المشاركة الأصلية");
      }
    }

    // Share or Download (Web Only)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "invitation.png", { type: "image/png" });

    let supportsFileSharing = Boolean(navigator.share);
    if (supportsFileSharing && navigator.canShare) {
      try {
        supportsFileSharing = navigator.canShare({ files: [file] });
      } catch {
        supportsFileSharing = false;
      }
    }

    if (supportsFileSharing) {
      try {
        await navigator.share({
          files: [file],
          title,
          text: `ندعوكم لحضور: ${title}`,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        toast.error("فشل المشاركة");
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "invitation.png";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("تم تحميل بطاقة الدعوة بنجاح");
    }
  },
};

const BiometricAuth = registerPlugin<BiometricAuthPlugin>("BiometricAuth");
export { BiometricAuth };
