import { registerPlugin, Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export interface BiometricAuthPlugin {
  checkBiometry(): Promise<{ isAvailable: boolean }>;
  authenticate(options: { title: string; subtitle: string }): Promise<{ success: boolean }>;
}

export interface FamilySharingPlugin {
  shareInvitation(options: { title: string; date: string; location: string; templatePath?: string }): Promise<void>;
  shareImage(options: { base64Data: string }): Promise<void>;
}

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

/**
 * Enhanced Sharing: Generates a beautiful image on the fly and shares it.
 */
export const FamilySharing = {
  async shareInvitation({
    title,
    date,
    location,
    templatePath,
  }: {
    title: string;
    date: string;
    location: string;
    templatePath?: string;
  }) {
    /*
       Royal Update v2: Direct on Template Printing
       We now load the EXACT selected template image and draw text directly on it.
    */

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 2000; // Perfect 3:5 Aspect Ratio for Invitations
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    // 2. Load Logo for Watermark / Seal
    const logo = await loadImage("/logo-home.png");
    if (logo.width > 0) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(logo, 500, 100, 200, 200);
      ctx.globalAlpha = 1.0;
    }

    // 3. Draw Typography (Emerald & Gold)
    ctx.textAlign = "center";
    ctx.fillStyle = "#183f36"; // Match UI emerald

    // Header
    ctx.font = 'bold 90px "Amiri", serif';
    ctx.fillText("دعوة عائلية", 600, 450);

    // Decorative Separator
    ctx.strokeStyle = "#D4AF37";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(400, 480);
    ctx.lineTo(800, 480);
    ctx.stroke();

    // Event Title (Primary Focus)
    ctx.fillStyle = "#064E3B";
    ctx.font = 'bold 110px "Tajawal", sans-serif';
    ctx.fillText(title, 600, 750);

    // Details Styling
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

    // Footer Signature
    ctx.fillStyle = "rgba(24, 63, 54, 0.5)";
    ctx.font = 'italic 35px "Amiri", serif';
    ctx.fillText("صُدرت من مجلس عائلة السيف الرقمي", 600, 1800);
    ctx.fillText("نصل العائلة، نحفظ الإرث، ونبني المستقبل", 600, 1860);

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
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "invitation.png", { type: "image/png" });

      if (navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: title,
            text: `ندعوكم لحضور: ${title}`,
          });
        } catch (e) {
          toast.error("فشل المشاركة");
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "invitation.png";
        a.click();
        toast.success("تم تحميل بطاقة الدعوة بنجاح");
      }
    });
  },
};

const BiometricAuth = registerPlugin<BiometricAuthPlugin>("BiometricAuth");
export { BiometricAuth };
