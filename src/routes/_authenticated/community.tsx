import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";
import { Plus, Send, Loader2, X, Handshake, Lock, Image as ImageIcon, Vote, BookOpen, HelpCircle } from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { OfflineCache } from "@/lib/offline-cache";
import { consumeQuickCreate } from "@/lib/quick-create";
import { PrivateRequestsSection } from "@/components/community/private-requests";
import { MemberDialog } from "@/components/community/member-dialog";
import { PUBLIC_MEMBER_POST_KINDS } from "@/lib/member-post-rotation";
import { PostCard, type CommunityPost as Post } from "@/components/community/post-card";

export const Route = createFileRoute("/_authenticated/community")({
  ssr:false,
  validateSearch:(search:Record<string,unknown>):{post?:string;create?:string;request?:string}=>({
    request:typeof search.request==="string"&&/^[0-9a-f-]{36}$/i.test(search.request)?search.request:undefined,
    post:typeof search.post==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.post)?search.post:undefined,
    create:typeof search.create==="string"?search.create:undefined,
  }),
  head:()=>({meta:[{title:"ركن الأعضاء — السيف"},{name:"description",content:"مساحة الأعضاء لمشاركة اليوميات والأسئلة مع تصويت العائلة."}]}),
  component:CommunityPage,
});
const KIND_META={diary:{label:"يوميات",icon:BookOpen},question:{label:"سؤال للعائلة",icon:HelpCircle}};

const COMMUNITY_PAGE_SIZE = 20;
const COMMUNITY_CACHE_PREFIX = "member_corner_posts";

function CommunityPage(){
 const selectedPostId=Route.useSearch().post;
 const openRequestId=Route.useSearch().request;
 const {
   userId:meId,
   canManageSection,
   isChairman,
   isViceChairman,
   isTechnicalAdmin,
   managesSection,
   isLoading:roleLoading,
 }=useUserRole();
 const isHead=canManageSection("community");

 const [profile,setProfile]=useState({name:"",role:"",initial:"ع",avatarPath:null as string|null});
 const [posts,setPosts]=useState<Post[]>([]);
 const [comments,setComments]=useState<any[]>([]);
 const [votes,setVotes]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadingMore,setLoadingMore]=useState(false);
 const [hasMore,setHasMore]=useState(true);
 const [showAdd,setShowAdd]=useState(false);
 const [showRequests,setShowRequests]=useState(!!openRequestId);
 useEffect(()=>{if(openRequestId)setShowRequests(true)},[openRequestId]);
 const requestsTriggerRef=useRef<HTMLButtonElement>(null);
 const [filter,setFilter]=useState<string>("all");
 const postsRef=useRef<Post[]>([]);
 const postIdsRef=useRef<string[]>([]);
 const [selectedPost,setSelectedPost]=useState<{post:Post;comments:any[];votes:any[]}|null>(null);
 const [selectedLoading,setSelectedLoading]=useState(false);
 const selectedRequestRef=useRef(0);

 // Resolve the chosen post separately: old posts must open without loading the entire feed.
 const loadSelectedPost=useCallback(async()=>{
   const request=++selectedRequestRef.current;
   if(!meId||!selectedPostId){setSelectedPost(null);setSelectedLoading(false);return;}
   setSelectedPost(current=>current?.post.id===selectedPostId?current:null);
   setSelectedLoading(true);
   try{
     const{data:post,error}=await supabase.from("member_posts").select("*")
       .eq("id",selectedPostId).in("kind",PUBLIC_MEMBER_POST_KINDS).maybeSingle();
     if(error)throw error;
     if(!post){if(request===selectedRequestRef.current)setSelectedPost(null);return;}
     const[{data:coms,error:commentError},{data:vs,error:voteError}]=await Promise.all([
       supabase.from("member_post_comments").select("*").eq("post_id",post.id).order("created_at",{ascending:true}),
       supabase.from("member_post_votes").select("*").eq("post_id",post.id),
     ]);
     if(commentError||voteError)throw commentError||voteError;
     const authorIds=[...new Set([post.author_id,...(coms??[]).map(comment=>comment.author_id)])];
     const{data:profiles}=await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id",authorIds);
     if(request!==selectedRequestRef.current)return;
     const authors=new Map((profiles??[]).map(profile=>[profile.id,profile]));
     setSelectedPost({
       post:{...post,poll_options:post.poll_options as Post["poll_options"],author:authors.get(post.author_id)},
       comments:(coms??[]).map(comment=>({...comment,author:authors.get(comment.author_id)})),
       votes:vs??[],
     });
   }catch{
     if(request===selectedRequestRef.current)setSelectedPost(null);
   }finally{
     if(request===selectedRequestRef.current)setSelectedLoading(false);
   }
 },[meId,selectedPostId]);

 useEffect(()=>{
   void loadSelectedPost();
   return()=>{selectedRequestRef.current+=1;};
 },[loadSelectedPost]);

 useEffect(()=>{
   if(!meId||!selectedPostId)return;
   const refresh=()=>{void loadSelectedPost();};
   const channel=supabase.channel(`community-selected-${selectedPostId}`)
     .on("postgres_changes",{event:"*",schema:"public",table:"member_posts",filter:`id=eq.${selectedPostId}`},refresh)
     .on("postgres_changes",{event:"*",schema:"public",table:"member_post_comments",filter:`post_id=eq.${selectedPostId}`},refresh)
     .on("postgres_changes",{event:"*",schema:"public",table:"member_post_votes",filter:`post_id=eq.${selectedPostId}`},refresh)
     .subscribe();
   return()=>{void supabase.removeChannel(channel);};
 },[meId,selectedPostId,loadSelectedPost]);

 useEffect(()=>{
   if(selectedPost?.post.id)document.getElementById("member-corner-selected")?.scrollIntoView({block:"start"});
 },[selectedPost?.post.id]);

 useEffect(()=>{
   if(roleLoading||!meId)return;
   if(consumeQuickCreate("community"))setShowAdd(true);
 },[roleLoading,meId]);

 useEffect(()=>{
   if(!meId)return;
   const cached=OfflineCache.load(`${COMMUNITY_CACHE_PREFIX}:${meId}`);
   if(Array.isArray(cached)&&cached.length>0){
     const cachedPosts=cached as Post[];
     postsRef.current=cachedPosts;
     postIdsRef.current=cachedPosts.map(post=>post.id);
     setPosts(cachedPosts);
     setLoading(false);
   }
 },[meId]);

 const loadEngagement=useCallback(async(postIds:string[])=>{
   if(postIds.length===0){
     setComments([]);
     setVotes([]);
     return;
   }

   try{
     const[{data:coms,error:commentsError},{data:vs,error:votesError}]=await Promise.all([
       supabase
         .from("member_post_comments" as any)
         .select("*")
         .in("post_id",postIds)
         .order("created_at",{ascending:true}),
       supabase
         .from("member_post_votes" as any)
         .select("*")
         .in("post_id",postIds),
     ]);

     if(commentsError) console.error("Member comments fetch error:",commentsError);
     if(votesError) console.error("Member votes fetch error:",votesError);

     if(coms){
       const authorIds=Array.from(new Set((coms as any[]).map((comment:any)=>comment.author_id).filter(Boolean)));
       const{data:commentProfiles}=authorIds.length
         ?await supabase
             .from("profiles")
             .select("id, arabic_name, full_name, avatar_url")
             .in("id",authorIds)
         :{data:[]};
       const profileMap=new Map((commentProfiles??[]).map((item:any)=>[item.id,item]));
       setComments((coms as any[]).map((comment:any)=>({
         ...comment,
         author:profileMap.get(comment.author_id)||null,
       })));
     }

     setVotes((vs as any[])||[]);
   }catch(error){
     console.error("Member engagement fetch error:",error);
   }
 },[]);

 const loadProfile=useCallback(async()=>{
   if(!meId)return;
   const{data:p,error}=await supabase
     .from("profiles")
     .select("id, arabic_name, full_name, avatar_url")
     .eq("id",meId)
     .maybeSingle();

   if(error){
     console.error("Member profile fetch error:",error);
     return;
   }

   if(p){
     setProfile({
       name:p.arabic_name||p.full_name||"عضو",
       role:"",
       initial:(p.arabic_name?.[0]||"ع").toUpperCase(),
       avatarPath:p.avatar_url,
     });
   }
 },[meId]);

 const loadPosts=useCallback(async(
   options:{append?:boolean;silent?:boolean}={},
 )=>{
   if(!meId)return;
   const append=options.append===true;
   const silent=options.silent===true;
   const hasVisiblePosts=postsRef.current.length>0;

   if(append)setLoadingMore(true);
   else if(!silent&&!hasVisiblePosts)setLoading(true);

   try{
     const offset=append?postsRef.current.length:0;
     const requestedCount=append
       ?COMMUNITY_PAGE_SIZE
       :Math.max(COMMUNITY_PAGE_SIZE,postsRef.current.length);

     const{data:rawPosts,error}=await supabase
       .from("member_posts" as any)
       .select("*")
       .order("pinned",{ascending:false})
       .order("created_at",{ascending:false})
       .range(offset,offset+requestedCount-1);

     if(error)throw error;

     const page=(rawPosts as any[])||[];
     const authorIds=Array.from(new Set(page.map(post=>post.author_id).filter(Boolean)));
     const{data:authorProfiles}=authorIds.length
       ?await supabase
           .from("profiles")
           .select("id, arabic_name, full_name, avatar_url")
           .in("id",authorIds)
       :{data:[]};
     const profileMap=new Map((authorProfiles??[]).map((item:any)=>[item.id,item]));
     const processed=page.map((post:any)=>({
       ...post,
       author:profileMap.get(post.author_id)||null,
     })) as Post[];

     const merged=append
       ?[
           ...postsRef.current,
           ...processed.filter(post=>!postsRef.current.some(current=>current.id===post.id)),
         ]
       :processed;

     postsRef.current=merged;
     postIdsRef.current=merged.map(post=>post.id);
     setPosts(merged);
     setHasMore(page.length===requestedCount);
     OfflineCache.save(`${COMMUNITY_CACHE_PREFIX}:${meId}`,merged);
     setLoading(false);

     void loadEngagement(postIdsRef.current);
   }catch(error){
     console.error("Member posts fetch error:",error);
     if(!hasVisiblePosts)toast.error("تعذر تحميل مشاركات ركن الأعضاء");
   }finally{
     if(append)setLoadingMore(false);
     if(!hasVisiblePosts)setLoading(false);
   }
 },[meId,loadEngagement]);

 const loadData=useCallback(async()=>{
   await loadPosts({silent:postsRef.current.length>0});
 },[loadPosts]);

 useEffect(()=>{
   if(meId){
     void loadPosts({silent:postsRef.current.length>0});
     return;
   }
   if(!roleLoading)setLoading(false);
 },[meId,roleLoading,loadPosts]);

 useEffect(()=>{
   if(meId)void loadProfile();
 },[meId,loadProfile]);

 useEffect(()=>{
   if(!meId)return;
   const channel=supabase
     .channel("community-realtime")
     .on("postgres_changes",{event:"*",schema:"public",table:"member_posts"},()=>{
       void loadPosts({silent:true});
     })
     .on("postgres_changes",{event:"*",schema:"public",table:"member_post_comments"},()=>{
       void loadEngagement(postIdsRef.current);
     })
     .on("postgres_changes",{event:"*",schema:"public",table:"member_post_votes"},()=>{
       void loadEngagement(postIdsRef.current);
     })
     .subscribe();

   return()=>{supabase.removeChannel(channel)};
 },[meId,loadPosts,loadEngagement]);

 const shellProfile=useMemo(()=>({
   ...profile,
   role:isChairman
     ?"رئيس المجلس"
     :isViceChairman
       ?"نائب رئيس المجلس"
       :isTechnicalAdmin
         ?"المسؤول التقني"
         :managesSection("community")
           ?"مسؤول ركن الأعضاء"
           :"عضو",
 }),[profile,isChairman,isViceChairman,isTechnicalAdmin,managesSection]);


 const filtered=useMemo(()=>{
   const visible=posts.filter(post=>post.kind!=="request");
   return filter==="all"?visible:visible.filter(post=>filter==="diary"?(post.kind==="diary"||post.kind==="photo"):post.kind===filter);
 },[posts,filter,isChairman,meId]);

 return <AppShell title="ركن الأعضاء" user={shellProfile}>
   <div className="community-feed" dir="rtl">
     <section className="community-feed-hero" aria-labelledby="community-title">
       <div><h2 id="community-title">ركن الأعضاء</h2><p>لحظات، أسئلة ومشاركات تجمع العائلة</p></div>
       <div className="community-hero-icon" aria-hidden="true"><Handshake size={34} strokeWidth={1.5}/></div>
     </section>
     <div className="community-toolbar">
       <div className="community-filters" role="group" aria-label="تصفية المشاركات">
         <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="الكل"/>
         {Object.entries(KIND_META).map(([kind, meta]) => <FilterChip key={kind} active={filter === kind} onClick={() => setFilter(kind)} label={meta.label}/>)}
       </div>
       <button ref={requestsTriggerRef} type="button" className="community-requests-trigger" aria-expanded={showRequests} aria-controls="community-private-requests" onClick={() => setShowRequests(!showRequests)}><Lock size={16}/>طلباتي الخاصة</button>
       <button type="button" className="community-create" onClick={() => setShowAdd(true)}><Plus size={17}/>مشاركة جديدة</button>
     </div>
     {showRequests && <section id="community-private-requests" className="community-requests-panel" aria-label="الطلبات الخاصة">
       <div className="community-requests-close"><button type="button" className="community-icon-button" aria-label="إغلاق الطلبات الخاصة" onClick={() => { setShowRequests(false); requestsTriggerRef.current?.focus({preventScroll:true}); }}><X size={18}/></button></div>
       <PrivateRequestsSection initialOpenId={openRequestId}/>
     </section>}
     {selectedPostId && <section id="member-corner-selected" className="community-selected" aria-label="المشاركة المختارة">
       <div className="community-selected-heading"><h3>المشاركة المختارة</h3><Link to="/community" search={{}}><X size={15}/>العودة لجميع المشاركات</Link></div>
       {selectedLoading && !selectedPost
         ? <div className="community-loading" role="status"><Loader2 className="animate-spin" size={24}/>جاري فتح المشاركة…</div>
         : selectedPost
           ? <PostCard key={selectedPost.post.id} post={selectedPost.post} meId={meId} isHead={isHead} canDelete={isHead || selectedPost.post.author_id === meId} comments={selectedPost.comments} votes={selectedPost.votes} onRefresh={async () => { await Promise.all([loadData(), loadSelectedPost()]); }}/>
           : <p className="community-feed-empty" role="status">هذه المشاركة غير موجودة أو غير متاحة.</p>}
     </section>}
     <div className="community-feed-list">
       {loading
         ? <div className="community-loading" role="status"><Loader2 className="animate-spin" size={24}/>جاري تحميل المشاركات…</div>
         : filtered.length === 0
           ? <div className="community-feed-empty">لا توجد مشاركات بعد — كن أول من يبدأ</div>
           : filtered.filter(post => post.id !== selectedPost?.post.id).map(post => <PostCard key={post.id} post={post} meId={meId} isHead={isHead} canDelete={isHead || post.author_id === meId} comments={comments.filter(comment => comment.post_id === post.id)} votes={votes.filter(vote => vote.post_id === post.id)} onRefresh={loadData}/>)}
       {!loading && hasMore && <button type="button" className="community-load-more" disabled={loadingMore} onClick={() => void loadPosts({ append: true, silent: true })}>{loadingMore && <Loader2 className="animate-spin" size={17}/>}<span>{loadingMore ? "جاري التحميل…" : "تحميل مشاركات أقدم"}</span></button>}
     </div>
   </div>
   {showAdd && <AddPostDialog meId={meId} onClose={() => setShowAdd(false)} onSaved={loadData}/>}
 </AppShell>;
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" className="community-filter" aria-pressed={active} onClick={onClick}>{label}</button>;
}

function AddPostDialog({meId,onClose,onSaved}:any){
 const[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false);const[kind,setKind]=useState<"diary"|"question">("diary"),[title,setTitle]=useState(""),[body,setBody]=useState(""),[images,setImages]=useState<string[]>([]),[withPoll,setWithPoll]=useState(false),[pollOptions,setPollOptions]=useState<string[]>(["",""]);
 const upload=async(files:FileList|null)=>{if(!files||!meId)return;setUploading(true);const urls:string[]=[];try{for(const f of Array.from(files)){const path=`${meId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;const{error}=await supabase.storage.from("community-media").upload(path,f,{upsert:false});if(error){toast.error("تعذر رفع الصورة");continue}const{data}=await supabase.storage.from("community-media").createSignedUrl(path,60*60*24*365*5);if(data?.signedUrl)urls.push(data.signedUrl)}setImages(prev=>[...prev,...urls])}finally{setUploading(false)}};
 const submit=async(e:any)=>{e.preventDefault();if(!title.trim())return toast.error("أدخل عنواناً");const opts=withPoll?pollOptions.map(o=>o.trim()).filter(Boolean).map(label=>({label})):null;if(withPoll&&(!opts||opts.length<2))return toast.error("التصويت يحتاج خيارَين على الأقل");setSaving(true);const{error}=await supabase.from("member_posts" as any).insert({author_id:meId,kind,title:title.trim(),body:body.trim()||null,image_urls:images,poll_options:opts} as any);setSaving(false);if(error)toast.error("تعذر النشر: "+error.message);else{toast.success("تم النشر");onSaved();onClose()}};
 return <MemberDialog title="مشاركة جديدة" description="شارك يومياتك أو اطرح سؤالاً للعائلة مع الصور والتصويت." icon={<Plus size={22}/>} onClose={onClose} className="community-compose" wide><form onSubmit={submit} className="member-dialog-form text-foreground"><div className="member-dialog-scroll space-y-5"><div className="grid grid-cols-2 gap-3">{Object.entries(KIND_META).map(([k,m])=>{const I=m.icon,active=kind===k;return <button type="button" key={k} onClick={()=>setKind(k as any)} aria-pressed={active} className="community-kind-option p-4 rounded-2xl border-2 flex flex-col items-center gap-2 bg-card text-foreground border-border"><I size={22}/><span className="text-xs font-black">{m.label}</span></button>})}</div><input value={title} onChange={e=>setTitle(e.target.value)} aria-label="عنوان المشاركة" placeholder="عنوان المشاركة..." className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border/60 font-black" required/><textarea value={body} onChange={e=>setBody(e.target.value)} aria-label="تفاصيل المشاركة" placeholder="اكتب تفاصيل المشاركة..." rows={5} className="w-full p-5 rounded-2xl bg-muted/40 border border-border/60 font-bold resize-none"/><div className="flex flex-wrap gap-2">{images.map((u,i)=><div key={i} className="size-20 rounded-2xl overflow-hidden relative"><img src={u} className="size-full object-cover" alt=""/><button type="button" aria-label={`حذف الصورة ${i+1}`} onClick={()=>setImages(images.filter((_,j)=>j!==i))} className="absolute top-1 left-1 size-6 rounded-full bg-black/60 text-white"><X size={12}/></button></div>)}<label className="size-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer">{uploading?<Loader2 className="animate-spin" size={20}/>:<ImageIcon size={20}/>}<input type="file" accept="image/*" aria-label="صور المشاركة" multiple className="hidden" onChange={e=>upload(e.target.files)}/></label></div><div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/60"><label className="flex items-center gap-3"><input type="checkbox" checked={withPoll} onChange={e=>setWithPoll(e.target.checked)}/><span className="text-sm font-black flex items-center gap-2"><Vote size={16}/> إضافة تصويت</span></label>{withPoll&&<div className="space-y-2">{pollOptions.map((opt,i)=><input key={i} value={opt} onChange={e=>{const copy=[...pollOptions];copy[i]=e.target.value;setPollOptions(copy)}} aria-label={`خيار التصويت ${i+1}`} placeholder={`الخيار ${i+1}`} className="w-full h-11 px-4 rounded-xl bg-card border border-border/60"/>)}{pollOptions.length<6&&<button type="button" onClick={()=>setPollOptions([...pollOptions,""])} className="w-full h-10 rounded-xl border-2 border-dashed border-border">+ إضافة خيار</button>}</div>}</div></div><div className="member-dialog-actions"><button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl font-black text-muted-foreground">تراجع</button><button disabled={saving||uploading} type="submit" className="flex-[2] btn-gold py-4 rounded-2xl font-black flex items-center justify-center gap-2">{saving?<Loader2 className="animate-spin size-5"/>:<><Send size={18}/><span>نشر</span></>}</button></div></form></MemberDialog>
}
