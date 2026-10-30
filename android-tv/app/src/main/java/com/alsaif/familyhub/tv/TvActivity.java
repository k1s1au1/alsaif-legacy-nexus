package com.alsaif.familyhub.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.IOException;
import java.util.Collections;
import java.util.Locale;

/** Dedicated landscape launcher. It shares the existing site's sign-in origin and RLS access. */
public final class TvActivity extends Activity {
    static final String HOST = "alsaif-legacy-nexus.lovable.app";
    static final String ORIGIN = "https://" + HOST;
    static final String START = ORIGIN + "/tv-app/index.html";
    private WebView web;
    private FrameLayout frame;
    private Button returnButton;
    private View errorView;
    private boolean backPending;
    private boolean mainLoadFailed;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        frame = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(7, 28, 25));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setTextZoom(100);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " AlsaifTV/1.1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return localResponse(request);
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) { mainLoadFailed = false; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localResponse(request);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (request.isForMainFrame() && isOwned(uri) && "/auth".equals(uri.getPath())) { view.loadUrl(START); return true; }
                if (isOwned(uri)) return false;
                if (request.hasGesture() && "https".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (android.content.ActivityNotFoundException ignored) { }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (mainLoadFailed) return;
                if (isOwned(Uri.parse(url)) && "/auth".equals(Uri.parse(url).getPath())) { view.loadUrl(START); return; }
                if (errorView != null) { frame.removeView(errorView); errorView = null; }
                returnButton.setVisibility(url.startsWith(ORIGIN + "/tv-app/") ? View.GONE : View.VISIBLE);
                if (!url.startsWith(ORIGIN + "/tv-app/")) installWebsiteRemoteNavigation();
                web.requestFocus();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { mainLoadFailed = true; showError(); }
            }
            @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                web.destroy(); web = null; recreate(); return true;
            }
        });
        frame.addView(web, new FrameLayout.LayoutParams(-1, -1));
        returnButton = new Button(this);
        returnButton.setText("العودة للتلفزيون");
        returnButton.setTextColor(Color.rgb(7, 28, 25));
        returnButton.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(213, 195, 148)));
        returnButton.setVisibility(View.GONE);
        returnButton.setOnClickListener(v -> web.loadUrl(START));
        FrameLayout.LayoutParams homeParams = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.LEFT);
        homeParams.setMargins(24, 12, 24, 12);
        frame.addView(returnButton, homeParams);
        setContentView(frame);
        if (savedState == null || web.restoreState(savedState) == null) web.loadUrl(START);
    }

    static boolean isOwned(Uri uri) { return "https".equalsIgnoreCase(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443); }

    private WebResourceResponse localResponse(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!isOwned(uri)) return null;
        String asset = localAsset(uri.getPath());
        if (asset == null) return null;
        try {
            return new WebResourceResponse(mime(asset), asset.endsWith(".html") || asset.endsWith(".js") || asset.endsWith(".css") ? "UTF-8" : null,
                200, "OK", Collections.singletonMap("Cache-Control", "no-cache"), getAssets().open(asset));
        } catch (IOException missing) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0]));
        }
    }

    static String localAsset(String path) {
        if (path == null || path.contains("..") || path.contains("\\") || path.indexOf('\0') >= 0) return null;
        if (path.equals("/tv-app") || path.equals("/tv-app/")) return "web/index.html";
        if (path.startsWith("/tv-app/")) return "web/" + path.substring("/tv-app/".length());
        if (path.startsWith("/occasion-templates/")) return "web" + path;
        if (path.equals("/logo-home.png")) return "web/logo-home.png";
        return null;
    }

    static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private void installWebsiteRemoteNavigation() {
        // The existing sign-in/settings pages remain in their own application.
        // Give their native controls a physical D-pad path without injecting a native bridge.
        web.evaluateJavascript("(function(){if(window.__alsaifRemote)return;window.__alsaifRemote=true;"
            + "document.addEventListener('keydown',function(e){if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;"
            + "var a=document.activeElement;if(a&&['INPUT','TEXTAREA','SELECT'].includes(a.tagName))return;"
            + "var bs=Array.from(document.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select,textarea')).filter(function(b){var r=b.getBoundingClientRect();return r.width&&r.height});"
            + "var i=bs.indexOf(a),n=i+(e.key==='ArrowDown'||e.key==='ArrowLeft'?1:-1);if(i<0)n=0;if(bs[n]){e.preventDefault();bs[n].focus();bs[n].scrollIntoView({block:'nearest'})}});"
            + "var first=document.querySelector('input:not(:disabled),button:not(:disabled)');if(first)first.focus();})()", null);
    }

    private void showError() {
        if (errorView != null) return;
        LinearLayout panel = new LinearLayout(this); panel.setOrientation(LinearLayout.VERTICAL); panel.setGravity(Gravity.CENTER);
        panel.setBackgroundColor(Color.rgb(7, 28, 25));
        TextView title = new TextView(this); title.setText("تعذّر الاتصال بالمجلس"); title.setTextColor(Color.rgb(245, 241, 232)); title.setTextSize(28);
        TextView hint = new TextView(this); hint.setText("تحقق من الإنترنت ثم أعد المحاولة"); hint.setTextColor(Color.rgb(200, 213, 204)); hint.setTextSize(19);
        Button retry = new Button(this); retry.setText("إعادة المحاولة"); retry.setOnClickListener(v -> { frame.removeView(panel); errorView = null; web.reload(); });
        panel.addView(title); panel.addView(hint); panel.addView(retry); errorView = panel;
        frame.addView(panel, new FrameLayout.LayoutParams(-1, -1)); retry.requestFocus();
    }

    @Override public void onBackPressed() {
        if (backPending) return;
        backPending = true;
        web.evaluateJavascript("Boolean(window.alsaifTvBack && window.alsaifTvBack())", result -> {
            backPending = false;
            if ("true".equals(result)) return;
            if (web.getUrl() != null && !web.getUrl().startsWith(ORIGIN + "/tv-app/")) { web.loadUrl(START); return; }
            new AlertDialog.Builder(this).setMessage("الخروج من مجلس السيف؟").setNegativeButton("البقاء", null).setPositiveButton("خروج", (dialog, which) -> finish()).show();
        });
    }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { CookieManager.getInstance().flush(); if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { ServiceWorkerController.getInstance().setServiceWorkerClient(null); if (web != null) { web.stopLoading(); web.destroy(); } super.onDestroy(); }
}
