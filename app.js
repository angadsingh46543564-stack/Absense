/*
  EduSphere - E-Learning Website Management System
  Demo frontend build. Developed by: Angad Singh
  B.Tech CSE, 5th Semester | I.K. Gujral Punjab Technical University (PTU), Jalandhar
*/
/* ===================== DATA LAYER ===================== */
const DB_KEY = 'edusphere_demo_db_v13';
let DB = null;
const SUPABASE_URL = 'https://fhmvghqkymtotglpxaev.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobXZnaHFreW10b3RnbHB4YWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MDU1ODYsImV4cCI6MjEwNjA4MTU4Nn0.HPTqwhMQYgSZoJW91ExRKglWyBbuu-vCmoOyciOivXc';
const sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
function loadDB(){ try{ const raw = localStorage.getItem(DB_KEY); if(raw) return JSON.parse(raw); }catch(e){} return seedDB(); }
function userFromRow(r){ return {id:r.id, role:r.role, name:r.name, email:r.email, pass:r.pass, status:r.status||undefined,
  points:r.points||0, streak:r.streak||0, lastActiveDate:r.last_active_date||null, badges:r.badges||[]}; }
function courseFromRow(r){ return {id:r.id, title:r.title, instructorId:r.instructor_id, instructorName:r.instructor_name,
  category:r.category, description:r.description, level:r.level, duration:r.duration, thumb:r.thumb, status:r.status,
  youtubeUrl:r.youtube_url, lessons:r.lessons||[], quiz:r.quiz||[]}; }
function enrFromRow(r){ return {id:r.id, studentId:r.student_id, courseId:r.course_id, enrolledAt:new Date(r.enrolled_at).getTime(),
  completedLessons:r.completed_lessons||[], lastLesson:r.last_lesson, quizScore:r.quiz_score, certificateIssued:r.certificate_issued}; }
function ntfFromRow(r){ return {id:r.id, userId:r.user_id, message:r.message, ts:r.ts, read:r.read}; }
function asgFromRow(r){ return {id:r.id, courseId:r.course_id, title:r.title, description:r.description, dueDate:r.due_date,
  maxMarks:r.max_marks, pdfName:r.pdf_name||'', pdfData:r.pdf_data||'', createdAt:r.created_at}; }
function subFromRow(r){ return {id:r.id, assignmentId:r.assignment_id, studentId:r.student_id, text:r.text,
  fileName:r.file_name||'', fileData:r.file_data||'', submittedAt:r.submitted_at}; }

async function loadDBAsync(){
  if(sb){
    try{
      const [u,c,e,n,a,s,m] = await Promise.all([
        sb.from('users').select('*'), sb.from('courses').select('*'), sb.from('enrollments').select('*'),
        sb.from('notifications').select('*'), sb.from('assignments').select('*'), sb.from('submissions').select('*'),
        sb.from('app_meta').select('*').eq('key','categories').maybeSingle()
      ]);
      if(!u.error && u.data && u.data.length>0){
        return {
          users: u.data.map(userFromRow),
          courses: (c.data||[]).map(courseFromRow),
          enrollments: (e.data||[]).map(enrFromRow),
          notifications: (n.data||[]).map(ntfFromRow),
          assignments: (a.data||[]).map(asgFromRow),
          submissions: (s.data||[]).map(subFromRow),
          categories: (m.data && m.data.value) ? m.data.value : ['Web Development','Data Science','Mobile Development','Design','Business','Programming Basics'],
          seq: 1
        };
      }
    }catch(err){ console.warn('Supabase load failed, falling back to local cache', err); }
  }
  return loadDB();
}
let saveTimer=null;
function saveDB(){
  try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }catch(e){}
  if(sb){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(syncToSupabase, 500);
  }
}
async function syncToSupabase(){
  if(!sb) return;
  try{
    const userRows = DB.users.map(u=>({id:u.id, role:u.role, name:u.name, email:u.email, pass:u.pass, status:u.status||null,
      points:u.points||0, streak:u.streak||0, last_active_date:u.lastActiveDate||null, badges:u.badges||[]}));
    const courseRows = DB.courses.map(c=>({id:c.id, title:c.title, instructor_id:c.instructorId, instructor_name:c.instructorName,
      category:c.category, description:c.description, level:c.level, duration:c.duration, thumb:c.thumb, status:c.status,
      youtube_url:c.youtubeUrl||null, lessons:c.lessons||[], quiz:c.quiz||[]}));
    const enrRows = DB.enrollments.map(e=>({id:e.id, student_id:e.studentId, course_id:e.courseId,
      enrolled_at:new Date(e.enrolledAt).toISOString(), completed_lessons:e.completedLessons||[],
      last_lesson:e.lastLesson||null, quiz_score:e.quizScore, certificate_issued:!!e.certificateIssued}));
    const ntfRows = DB.notifications.map(n=>({id:n.id, user_id:n.userId, message:n.message, ts:n.ts, read:!!n.read}));
    const asgRows = DB.assignments.map(a=>({id:a.id, course_id:a.courseId, title:a.title, description:a.description,
      due_date:a.dueDate||null, max_marks:a.maxMarks, pdf_name:a.pdfName||null, pdf_data:a.pdfData||null, created_at:a.createdAt}));
    const subRows = DB.submissions.map(s=>({id:s.id, assignment_id:s.assignmentId, student_id:s.studentId,
      text:s.text||null, file_name:s.fileName||null, file_data:s.fileData||null, submitted_at:s.submittedAt}));

    // delete rows removed locally, then upsert current state (order respects foreign keys)
    const del = async (table, rows) => {
      const { data: existing } = await sb.from(table).select('id');
      const keep = new Set(rows.map(r=>r.id));
      const toDelete = (existing||[]).map(r=>r.id).filter(id=>!keep.has(id));
      if(toDelete.length) await sb.from(table).delete().in('id', toDelete);
    };
    await del('submissions', subRows); await del('assignments', asgRows);
    await del('notifications', ntfRows); await del('enrollments', enrRows);
    await del('courses', courseRows); await del('users', userRows);

    if(userRows.length) await sb.from('users').upsert(userRows);
    if(courseRows.length) await sb.from('courses').upsert(courseRows);
    if(enrRows.length) await sb.from('enrollments').upsert(enrRows);
    if(ntfRows.length) await sb.from('notifications').upsert(ntfRows);
    if(asgRows.length) await sb.from('assignments').upsert(asgRows);
    if(subRows.length) await sb.from('submissions').upsert(subRows);
    await sb.from('app_meta').upsert({key:'categories', value: DB.categories});
  }catch(err){ console.warn('Supabase sync failed', err); }
}
function uid(prefix){ return prefix + Math.random().toString(36).slice(2,9); }
const EMAIL_FN_URL = 'https://fhmvghqkymtotglpxaev.supabase.co/functions/v1/send-email';
function sendEmail(to, subject, html){
  if(!to) return;
  fetch(EMAIL_FN_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json', 'apikey':SUPABASE_KEY, 'Authorization':'Bearer '+SUPABASE_KEY},
    body: JSON.stringify({to, subject, html})
  }).catch(e=>console.warn('Email send failed', e));
}
function emailShell(title, bodyHtml){
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:10px;">
    <h2 style="color:#5b3df0;margin-top:0;">EduSphere</h2>
    <h3>${title}</h3>
    ${bodyHtml}
    <p style="font-size:11px;color:#888;margin-top:24px;">You're receiving this because of activity on your EduSphere account.</p>
  </div>`;
}

function seedDB(){
  const now = Date.now();
  const db = {
    settings:{ siteName:'EduSphere', tagline:'Learn Without Limits' },
    categories:['Web Development','Data Science','Mobile Development','Design','Business','Programming Basics'],
    users:[
      {id:'u_admin', role:'admin', name:'Site Admin', email:'admin@demo.com', pass:'admin123'},
      {id:'u_inst1', role:'instructor', name:'Arjun Deshmukh', email:'instructor@demo.com', pass:'pass1234', status:'approved'},
      {id:'u_inst2', role:'instructor', name:'Meera Nair', email:'meera@demo.com', pass:'pass1234', status:'approved'},
      {id:'u_stu1', role:'student', name:'Priya Mehta', email:'student@demo.com', pass:'pass1234'},
      {id:'u_stu2', role:'student', name:'Karan Bedi', email:'karan@demo.com', pass:'pass1234'},
    ],
    courses:[],
    enrollments:[],
    notifications:[],
    assignments:[],
    submissions:[],
    wishlist:[],
    feedback:[
      {id:uid('fb'), from:'Priya Mehta', message:'Loving the quiz feature, really helps me revise!', ts: now-1000*60*60*24*3}
    ],
    seq:1
  };

  const LESSON_NOTES={"Introduction to HTML": "<p class=\"ov\" style=\"margin:0 0 12px;\">HTML (HyperText Markup Language) is the standard markup language used to create the structure and content of every webpage on the internet. It is not a programming language — it has no logic, loops, or calculations. Instead, it uses a system of <b>elements</b> (tags) to tell the browser what each piece of content is: a heading, a paragraph, a link, an image, a list, and so on. Every website you have ever visited, no matter how complex, has HTML underneath it as its skeleton.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Document Structure</h4><p style=\"margin:0 0 8px;\">Every valid HTML document begins with <code>&lt;!DOCTYPE html&gt;</code>, which tells the browser to render the page using modern HTML5 rules. This is followed by the <code>&lt;html&gt;</code> root element, which contains exactly two children: <code>&lt;head&gt;</code> and <code>&lt;body&gt;</code>. The <code>&lt;head&gt;</code> holds information the browser needs but the user doesn't directly see — the page title, character encoding, linked CSS files, and meta tags for SEO. The <code>&lt;body&gt;</code> holds everything the visitor actually sees and interacts with: text, images, buttons, forms.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Elements and Tags</h4><p style=\"margin:0 0 8px;\">An HTML element is usually made of an opening tag, content, and a closing tag: <code>&lt;p&gt;This is a paragraph.&lt;/p&gt;</code>. Some elements are 'void' elements with no closing tag and no content, such as <code>&lt;img&gt;</code> and <code>&lt;br&gt;</code>. Elements can be nested inside each other to build complex structures, but nesting must always be properly closed in the reverse order it was opened — improperly nested tags can break page rendering in unpredictable ways.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Attributes</h4><p style=\"margin:0 0 8px;\">Attributes provide additional information about an element and are written inside the opening tag as name-value pairs, e.g. <code>&lt;a href=\"https://example.com\" target=\"_blank\"&gt;Visit&lt;/a&gt;</code>. Common attributes include <code>id</code> (a unique identifier for one element), <code>class</code> (a reusable label used by many elements, mainly for CSS/JS targeting), <code>src</code> (the source file for images/scripts), and <code>href</code> (the destination link for anchors).</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Semantic HTML</h4><p style=\"margin:0 0 8px;\">Semantic tags describe the meaning of their content rather than just how it looks. Instead of wrapping everything in generic <code>&lt;div&gt;</code> tags, modern HTML uses <code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;article&gt;</code>, <code>&lt;section&gt;</code>, and <code>&lt;footer&gt;</code>. This matters for two big reasons: screen readers (used by visually impaired users) rely on semantic structure to describe a page, and search engines use it to understand and rank content — both are strong practical reasons to prefer semantic tags over plain divs wherever it makes sense.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Common Tags Cheat-Sheet</h4><p style=\"margin:0 0 8px;\">Headings: <code>&lt;h1&gt;</code> through <code>&lt;h6&gt;</code> (h1 = most important, used once per page ideally). Text: <code>&lt;p&gt;</code>, <code>&lt;strong&gt;</code> (bold/important), <code>&lt;em&gt;</code> (italic/emphasis). Lists: <code>&lt;ul&gt;</code> (unordered/bulleted) and <code>&lt;ol&gt;</code> (ordered/numbered), both containing <code>&lt;li&gt;</code> items. Media: <code>&lt;img src=\"...\" alt=\"...\"&gt;</code> (the <code>alt</code> text is shown if the image fails to load and read aloud by screen readers). Forms: <code>&lt;form&gt;</code>, <code>&lt;input&gt;</code>, <code>&lt;label&gt;</code>, <code>&lt;button&gt;</code> — the backbone of any page that collects user input.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">HTML provides structure, not style or behavior — those come from CSS and JavaScript respectively. A clean, semantic, properly nested document is easier to style, easier to make accessible, and easier to maintain as a project grows. Always start any web project by planning the HTML structure first, before touching any CSS.</p>", "Styling with CSS": "<p class=\"ov\" style=\"margin:0 0 12px;\">CSS (Cascading Style Sheets) is the language used to control how HTML content looks — colors, spacing, fonts, positioning, and responsiveness across devices. Without CSS, every webpage would just be plain black text on a white background, top to bottom, in the order it appears in the HTML.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Ways to Add CSS</h4><p style=\"margin:0 0 8px;\">There are three ways to apply CSS: inline (a <code>style</code> attribute directly on one element — quick but hard to maintain), internal (a <code>&lt;style&gt;</code> block inside the HTML <code>&lt;head&gt;</code>), and external (a separate .css file linked with <code>&lt;link rel=\"stylesheet\" href=\"style.css\"&gt;</code>). External stylesheets are the standard for any real project because they keep structure (HTML) and presentation (CSS) cleanly separated and reusable across multiple pages.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Selectors and Specificity</h4><p style=\"margin:0 0 8px;\">Selectors decide *which* elements a rule applies to: <code>p</code> targets every paragraph, <code>.card</code> targets every element with class 'card', <code>#header</code> targets the one element with id 'header', and <code>.card p</code> targets paragraphs specifically inside elements with class 'card'. When multiple rules could apply to the same element, CSS uses a specificity system to decide which one wins: inline styles beat IDs, IDs beat classes, and classes beat plain tag selectors. Understanding specificity is essential for debugging 'why isn't my CSS working' problems.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">The Box Model</h4><p style=\"margin:0 0 8px;\">Every single HTML element is rendered by the browser as a rectangular box made of four layers, from the inside out: <b>content</b> (the text/image itself), <b>padding</b> (space between content and the border), <b>border</b> (the edge of the box), and <b>margin</b> (space outside the border, separating it from neighboring elements). By default, an element's declared width/height only applies to the content area — adding padding/border increases the total rendered size, unless <code>box-sizing: border-box</code> is used, which is why most modern projects set that globally.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Flexbox</h4><p style=\"margin:0 0 8px;\">Flexbox (<code>display: flex</code>) is designed for laying out items in a single row or column. The parent becomes a 'flex container' and its direct children become 'flex items'. Key properties: <code>justify-content</code> controls alignment along the main axis (e.g. spacing buttons evenly in a navbar), <code>align-items</code> controls alignment along the cross axis (e.g. vertically centering items), and <code>flex-wrap</code> lets items move to a new line when space runs out. Flexbox solved decades-old problems like vertical centering that used to require awkward hacks.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">CSS Grid</h4><p style=\"margin:0 0 8px;\">CSS Grid (<code>display: grid</code>) is designed for two-dimensional layouts — rows AND columns at once, which makes it ideal for full page layouts (header, sidebar, main content, footer). You define a grid template with <code>grid-template-columns</code> and <code>grid-template-rows</code>, and place items into specific cells. Flexbox and Grid are not competitors — real projects commonly use Grid for overall page layout and Flexbox for aligning items within smaller components.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Responsive Design</h4><p style=\"margin:0 0 8px;\">A responsive site adapts its layout to different screen sizes (phone, tablet, desktop) instead of looking broken on anything but the exact size it was designed for. This relies on relative units (<code>%</code>, <code>rem</code>, <code>vw</code>/<code>vh</code>) instead of only fixed pixels, plus <code>@media</code> queries such as <code>@media (max-width: 600px) { ... }</code> to apply different CSS rules below a certain screen width. Mobile-first design (writing base CSS for small screens, then adding rules for larger screens) is the generally recommended modern approach.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">CSS is cascading and inherited — rules can come from multiple places and combine, with specificity and source order deciding conflicts. Mastering the box model, Flexbox, and basic responsive queries covers the vast majority of real-world layout needs.</p>", "JavaScript Basics": "<p class=\"ov\" style=\"margin:0 0 12px;\">JavaScript is the programming language that makes webpages interactive — it can respond to clicks, validate forms, fetch data from servers, update content live without reloading the page, and much more. Unlike HTML and CSS, JavaScript is a full programming language with variables, logic, functions, and loops.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Variables</h4><p style=\"margin:0 0 8px;\">Modern JavaScript uses <code>let</code> for variables that may be reassigned later, and <code>const</code> for values that should never be reassigned after being set (the older <code>var</code> keyword is now avoided because of confusing scoping rules). A good rule of thumb: default to <code>const</code>, and only use <code>let</code> when you know the value needs to change, e.g. a counter in a loop.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Data Types</h4><p style=\"margin:0 0 8px;\">JavaScript has a handful of core types: <code>string</code> (text, in quotes), <code>number</code> (both integers and decimals — there is no separate 'float' type), <code>boolean</code> (true/false), <code>object</code> (key-value collections, including arrays), <code>null</code> (an intentional 'nothing'), and <code>undefined</code> (a variable that has been declared but not yet given a value). You can check a value's type at runtime with the <code>typeof</code> operator.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Operators and Conditions</h4><p style=\"margin:0 0 8px;\">Comparison operators like <code>===</code> (strict equality, checks both value AND type) should be preferred over <code>==</code> (loose equality, which silently converts types and causes subtle bugs). Conditions are written with <code>if</code>, <code>else if</code>, and <code>else</code> blocks to run different code depending on a condition being true or false.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Functions</h4><p style=\"margin:0 0 8px;\">A function is a reusable block of code. It can be written as a traditional declaration (<code>function greet(name) { return 'Hi ' + name; }</code>), or as a modern arrow function (<code>const greet = (name) =&gt; 'Hi ' + name;</code>), which is shorter and behaves slightly differently with respect to the <code>this</code> keyword. Functions can take parameters (inputs) and use <code>return</code> to send a value back to whoever called them.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Arrays and Loops</h4><p style=\"margin:0 0 8px;\">An array is an ordered list of values: <code>const fruits = ['apple','banana','mango'];</code>. Classic loops like <code>for</code> and <code>while</code> can iterate through them, but modern JavaScript also provides array methods that are shorter and often clearer: <code>.forEach()</code> to run code on every item, <code>.map()</code> to transform every item into a new array, and <code>.filter()</code> to keep only items matching a condition.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Objects</h4><p style=\"margin:0 0 8px;\">An object groups related data together as key-value pairs: <code>const user = { name: 'Angad', age: 21 };</code>. You access properties with dot notation (<code>user.name</code>) or bracket notation (<code>user['name']</code>). Objects are the foundation for representing anything structured — a student record, a product, a form's data — in JavaScript.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">JavaScript brings logic and interactivity to a page that HTML/CSS alone cannot provide. A solid grip on variables, functions, arrays, and objects is the foundation for everything more advanced — including DOM manipulation, which is covered next.</p>", "DOM Manipulation": "<p class=\"ov\" style=\"margin:0 0 12px;\">The DOM (Document Object Model) is the browser's live, in-memory tree representation of an HTML page. Every tag becomes a 'node' in this tree, and JavaScript can read, add, remove, or change any of these nodes — which is exactly how a page becomes interactive after it has loaded.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Selecting Elements</h4><p style=\"margin:0 0 8px;\">The modern, flexible way to select elements is <code>document.querySelector('.my-class')</code> (returns the first match) and <code>document.querySelectorAll('.my-class')</code> (returns ALL matches as a list you can loop over). Both accept any valid CSS selector, which makes them consistent with the CSS you already know. The older <code>document.getElementById('id')</code> is still common and slightly faster, but less flexible.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Changing Content and Styles</h4><p style=\"margin:0 0 8px;\">Once you have selected an element, you can change what it shows with <code>.textContent</code> (plain text only, safest) or <code>.innerHTML</code> (can include HTML tags, but must be used carefully with untrusted input to avoid security issues). You can change its appearance directly with <code>element.style.color = 'red'</code>, though toggling pre-defined CSS classes with <code>.classList.add()</code>, <code>.remove()</code>, or <code>.toggle()</code> is usually the cleaner, more maintainable approach.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Handling Events</h4><p style=\"margin:0 0 8px;\">Events are actions the user performs — clicking, typing, submitting a form, hovering. You listen for them with <code>element.addEventListener('click', function(event) { ... })</code>. This is the single most important pattern in front-end JavaScript: virtually every interactive feature on a webpage — buttons, menus, forms, sliders — is built from event listeners reacting to user actions.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Creating and Removing Elements</h4><p style=\"margin:0 0 8px;\">New elements can be built entirely in JavaScript: <code>const div = document.createElement('div'); div.textContent = 'Hello';</code> and then inserted into the page with <code>parentElement.appendChild(div)</code>. Elements can similarly be removed with <code>.remove()</code>. This is how dynamic UIs — like a to-do list where items are added/removed without ever reloading the page — are built.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Event Delegation</h4><p style=\"margin:0 0 8px;\">Instead of attaching a separate listener to every single item in a list (which is wasteful and breaks for items added later), a common pattern is to attach ONE listener to a shared parent element, and check <code>event.target</code> inside it to figure out which child was actually clicked. This is called event delegation and is considered a best practice for lists and dynamically generated content.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">The DOM is the bridge between static HTML and a living, interactive page. Selecting elements, changing them, and reacting to events are the three core skills that, combined, are responsible for essentially all front-end interactivity you see on the modern web.</p>", "Building a Project": "<p class=\"ov\" style=\"margin:0 0 12px;\">Turning individual HTML, CSS, and JavaScript knowledge into one working project is where real learning happens. A project forces you to make structural decisions, debug real problems, and see how the three languages cooperate as a system rather than in isolation.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Planning First</h4><p style=\"margin:0 0 8px;\">Before writing any code, sketch the page (even roughly on paper) and list the features it needs. Break the page into logical sections (header, main content, footer, any reusable components like a card or button) — this becomes the outline for your HTML structure. Skipping this step is the most common reason beginner projects turn into a tangled mess.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Building the Skeleton</h4><p style=\"margin:0 0 8px;\">Start with the HTML only — no styling yet. Get every section, heading, image, button, and form on the page in the right order with semantic tags. This 'content-first' approach ensures the page still makes sense even before any CSS is applied, which is also good for accessibility and SEO by default.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Adding Style</h4><p style=\"margin:0 0 8px;\">Once the structure is solid, layer on CSS: overall page layout first (using Flexbox/Grid), then spacing and typography, then colors and finer visual details. Working in this order (big picture → details) avoids constantly re-doing layout work because of a late-stage design change.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Adding Behavior</h4><p style=\"margin:0 0 8px;\">JavaScript comes last, once the static page already looks right. Identify exactly which parts of the page need to react to user actions (a button, a form, a toggle menu) and attach event listeners only there. Keeping HTML/CSS/JS in separate files (not all inline) keeps a growing project organized and much easier to debug.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Testing and Debugging</h4><p style=\"margin:0 0 8px;\">Use browser DevTools constantly: the Elements tab to inspect the live DOM and CSS, and the Console tab to see JavaScript errors and log values with <code>console.log()</code>. Testing on different screen sizes (DevTools has a device toolbar for this) catches responsive design issues early, before they reach real users.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Deploying</h4><p style=\"margin:0 0 8px;\">A finished project isn't truly 'done' until it's shareable. Free static hosting services like Netlify or GitHub Pages let you upload your HTML/CSS/JS files and get a real, live URL in minutes — this is what turns a local file into something you can put on a resume or show an interviewer.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">A real project is built in layers — structure, then style, then behavior — and tested continuously along the way rather than all at the end. This workflow scales from a single-page project all the way up to professional production applications.</p>", "Python Syntax Refresher": "<p class=\"ov\" style=\"margin:0 0 12px;\">Python is known for being readable and beginner-friendly, which is a big reason it dominates data science. Unlike many languages, Python uses indentation (whitespace) to define code blocks instead of curly braces — this is not a style choice, it is mandatory syntax, and inconsistent indentation will cause errors.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Variables and Types</h4><p style=\"margin:0 0 8px;\">Python is dynamically typed — you don't declare a type, it's inferred automatically: <code>x = 5</code> makes x an int, <code>x = 5.0</code> makes it a float, <code>x = 'hello'</code> makes it a str. Core built-in types include int, float, str, bool, list, tuple, dict, and set, each with its own behavior and use case.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Control Flow</h4><p style=\"margin:0 0 8px;\">Conditions use <code>if</code>, <code>elif</code>, <code>else</code>. Loops come in two forms: <code>for item in collection:</code> to iterate over a sequence, and <code>while condition:</code> to repeat until a condition becomes false. Python also supports list comprehensions — a compact way to build a list in one line, e.g. <code>squares = [x*x for x in range(10)]</code>, which experienced Python programmers use constantly.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Functions</h4><p style=\"margin:0 0 8px;\">Functions are defined with <code>def function_name(parameters):</code> followed by an indented body, and return a value using <code>return</code>. Parameters can have default values (<code>def greet(name='friend'):</code>), and Python also supports keyword arguments, making function calls more readable at the call site.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Data Structures</h4><p style=\"margin:0 0 8px;\">A <b>list</b> (<code>[1,2,3]</code>) is ordered and mutable (changeable). A <b>tuple</b> (<code>(1,2,3)</code>) is ordered but immutable — used for fixed collections. A <b>dictionary</b> (<code>{'name':'Angad','age':21}</code>) stores key-value pairs, like a real-world lookup table. A <b>set</b> stores only unique, unordered values, useful for removing duplicates instantly.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Importing Libraries</h4><p style=\"margin:0 0 8px;\">Python's real power for data science comes from its ecosystem of libraries. You bring one into your code with <code>import numpy as np</code> or <code>from pandas import DataFrame</code>. This is how NumPy, Pandas, and Matplotlib — the core data science toolkit — get used in every script and notebook.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">A comfortable grip on Python's basic syntax — variables, control flow, functions, and the core data structures — is the prerequisite for everything that follows in data science: without it, NumPy and Pandas code will look like an unreadable wall of symbols instead of logical, learnable patterns.</p>", "NumPy Arrays": "<p class=\"ov\" style=\"margin:0 0 12px;\">NumPy ('Numerical Python') is the foundational library for numerical computing in Python. Its core object, the <b>ndarray</b>, is a fixed-type, multi-dimensional array that is dramatically faster and more memory-efficient than a plain Python list for numeric work — this speed is why almost every other data science library (Pandas, scikit-learn, TensorFlow) is built on top of NumPy.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Creating Arrays</h4><p style=\"margin:0 0 8px;\">Arrays can be built directly from a list — <code>np.array([1,2,3])</code> — or generated with helper functions: <code>np.zeros((3,3))</code> for a 3x3 grid of zeros, <code>np.ones(5)</code> for five ones, <code>np.arange(0,10,2)</code> for evenly stepped values (like Python's range but as an array), and <code>np.linspace(0,1,5)</code> for 5 evenly spaced values between 0 and 1.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Array Shape and Dimensions</h4><p style=\"margin:0 0 8px;\">Every array has a <code>.shape</code> — a tuple describing its size along each dimension. A 1D array might have shape <code>(5,)</code>, while a 2D array (a matrix/table) might have shape <code>(3,4)</code> — 3 rows, 4 columns. <code>.reshape()</code> lets you change an array's dimensions without changing its data, as long as the total element count matches.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Indexing and Slicing</h4><p style=\"margin:0 0 8px;\">Single elements and ranges are accessed similarly to Python lists but extended to multiple dimensions: <code>arr[0]</code> for the first row, <code>arr[1,2]</code> for the element at row 1, column 2, and <code>arr[:,0]</code> for the entire first column (the colon means 'every row'). This slicing syntax is used constantly when working with real datasets.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Vectorized Operations</h4><p style=\"margin:0 0 8px;\">NumPy's biggest advantage is vectorization: <code>arr * 2</code> multiplies every element by 2 in one fast operation, with no explicit loop needed. This applies to array-array operations too: <code>arr1 + arr2</code> adds corresponding elements. Writing vectorized code instead of manual for-loops is both dramatically faster and considered the idiomatic 'Pythonic' way to work with numeric data.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Useful Statistical Methods</h4><p style=\"margin:0 0 8px;\">NumPy arrays come with built-in statistics: <code>.sum()</code>, <code>.mean()</code>, <code>.std()</code> (standard deviation), <code>.max()</code>/<code>.min()</code>, and <code>.argmax()</code>/<code>.argmin()</code> (the *position* of the max/min value). These are used constantly during initial data exploration to quickly understand a dataset's basic properties.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">NumPy arrays are the fast, efficient backbone of numeric Python — think of them as supercharged lists that support whole-array math operations without writing manual loops. Comfort with array shape, indexing, and vectorized operations translates directly into comfort with Pandas, which is built on the exact same ideas.</p>", "Pandas DataFrames": "<p class=\"ov\" style=\"margin:0 0 12px;\">Pandas is the primary library for working with structured, tabular data in Python — the kind of data you'd normally see in a spreadsheet or a database table. Its two core objects are the <b>Series</b> (a single labeled column of data) and the <b>DataFrame</b> (a full table made of multiple Series sharing a common row index).</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Loading Data</h4><p style=\"margin:0 0 8px;\">The most common way real data enters a Pandas workflow is <code>df = pd.read_csv('file.csv')</code>, which reads a CSV file straight into a DataFrame. Pandas can also read Excel files (<code>pd.read_excel()</code>), JSON, and even data directly from SQL databases — making it the universal entry point for almost any dataset.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Exploring a DataFrame</h4><p style=\"margin:0 0 8px;\">Before doing anything else with a new dataset, explore it: <code>df.head()</code> shows the first 5 rows, <code>df.shape</code> gives (rows, columns), <code>df.info()</code> shows column types and missing values, and <code>df.describe()</code> gives quick summary statistics (mean, min, max, etc.) for every numeric column. This exploration step is considered mandatory professional practice before any real analysis.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Selecting Data</h4><p style=\"margin:0 0 8px;\">A single column is selected with <code>df['column_name']</code> (returns a Series); multiple columns with <code>df[['col1','col2']]</code> (returns a DataFrame). Row selection uses <code>.loc[]</code> for label-based indexing and <code>.iloc[]</code> for purely position-based indexing — mixing these two up is one of the most common beginner mistakes in Pandas.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Filtering Rows</h4><p style=\"margin:0 0 8px;\">Rows are filtered using boolean conditions inside square brackets: <code>df[df['score'] &gt; 60]</code> returns only the rows where the score column exceeds 60. Multiple conditions can be combined with <code>&amp;</code> (and) and <code>|</code> (or), each condition wrapped in its own parentheses — this pattern is used constantly for real-world data cleaning and analysis.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Grouping and Aggregating</h4><p style=\"margin:0 0 8px;\"><code>df.groupby('category')['sales'].sum()</code> groups rows by a shared value in one column and computes an aggregate (sum, mean, count, etc.) for another — this is directly equivalent to a pivot table in Excel, and is one of the single most powerful and frequently used Pandas operations for real analysis.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Handling Missing Data</h4><p style=\"margin:0 0 8px;\">Real-world data is rarely clean. <code>df.isnull().sum()</code> counts missing values per column, <code>df.dropna()</code> removes rows containing missing values, and <code>df.fillna(value)</code> replaces missing values with a chosen default (like 0, or a column's mean). Deciding how to handle missing data is itself an important analytical judgment call, not just a mechanical step.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Pandas turns messy real-world data into a structure you can reliably question and analyze. Mastering selection, filtering, and groupby covers the large majority of everyday data analysis tasks you will encounter in practice.</p>", "Data Visualization": "<p class=\"ov\" style=\"margin:0 0 12px;\">Data visualization turns numbers into pictures that are far faster for a human brain to interpret than raw tables. In Python, <b>Matplotlib</b> is the foundational plotting library that almost every other visualization tool (including Pandas' own built-in plotting and Seaborn) is built on top of.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Basic Matplotlib Workflow</h4><p style=\"margin:0 0 8px;\">The standard pattern is: <code>import matplotlib.pyplot as plt</code>, then build the plot (<code>plt.plot(x, y)</code>, <code>plt.bar(categories, values)</code>, <code>plt.scatter(x, y)</code>), and finally <code>plt.show()</code> to display it. Multiple plotting calls before <code>show()</code> layer elements onto the same chart.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Choosing the Right Chart Type</h4><p style=\"margin:0 0 8px;\">A <b>line chart</b> is best for showing a trend over a continuous variable like time. A <b>bar chart</b> is best for comparing distinct categories against each other. A <b>scatter plot</b> is best for showing the relationship (correlation) between two numeric variables. A <b>histogram</b> (<code>plt.hist()</code>) is best for showing the distribution/spread of a single numeric variable. Picking the wrong chart type for your data is one of the most common visualization mistakes.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Labeling a Chart</h4><p style=\"margin:0 0 8px;\">An unlabeled chart is close to useless for anyone but the person who made it. Always add <code>plt.title('...')</code>, <code>plt.xlabel('...')</code>, <code>plt.ylabel('...')</code>, and <code>plt.legend()</code> whenever multiple data series are shown on the same chart — these four lines should become an automatic habit for every plot you make.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Plotting Directly from Pandas</h4><p style=\"margin:0 0 8px;\">Pandas DataFrames have a convenient shortcut: <code>df['column'].plot(kind='bar')</code> or <code>df.plot(x='date', y='sales')</code> generates a Matplotlib chart directly from the data without needing to manually extract x/y values first — extremely useful during fast, exploratory analysis.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Seaborn (Optional Upgrade)</h4><p style=\"margin:0 0 8px;\">Seaborn is a library built on top of Matplotlib that produces more polished statistical charts (like heatmaps and boxplots) with less code and better default styling. It's commonly introduced right after Matplotlib once the fundamentals are solid, though Matplotlib alone is more than sufficient for most everyday charting needs.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Good visualization is about clarity, not decoration — choosing the right chart type and always labeling axes matters far more than making a chart 'look fancy'. A clear chart should let a viewer understand the main insight within a few seconds, without needing the code or a paragraph of explanation.</p>", "Mini Project": "<p class=\"ov\" style=\"margin:0 0 12px;\">A mini project is where individual skills — Python syntax, NumPy, Pandas, and Matplotlib — come together into one coherent workflow. It mirrors, at a small scale, exactly what a real data analyst or data scientist does professionally every day.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">The Standard Workflow</h4><p style=\"margin:0 0 8px;\">A typical data analysis project follows a repeatable pipeline: (1) load the data, (2) explore and understand it, (3) clean it, (4) analyze it to answer a specific question, and (5) visualize and communicate the findings. Skipping steps — especially exploration and cleaning — is the most common reason beginner analyses produce misleading conclusions.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Start With a Question</h4><p style=\"margin:0 0 8px;\">Before writing any code, define a clear question the analysis should answer — for example, 'which product category generates the most revenue?' or 'has user signups grown month over month?'. A focused question tells you exactly which columns matter and which chart type will best communicate the answer, instead of aimlessly exploring the whole dataset.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Cleaning the Data</h4><p style=\"margin:0 0 8px;\">Real datasets almost always need cleaning: removing duplicate rows (<code>df.drop_duplicates()</code>), handling missing values, fixing inconsistent text (e.g. 'india' vs 'India'), and converting columns to the correct data type (e.g. a date column stored as plain text). Skipping this step silently produces wrong results later, even though the code runs without any error.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Analysis and Grouping</h4><p style=\"margin:0 0 8px;\">This is where <code>groupby()</code>, filtering, and sorting are used to actually answer the question — e.g. grouping sales by category, then sorting to find the top performer. This step should always tie directly back to the original question defined at the start.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Visualizing and Communicating</h4><p style=\"margin:0 0 8px;\">The final chart(s) should be chosen specifically to answer the original question as clearly as possible — one focused, well-labeled chart beats five cluttered ones. A short written summary in plain language ('Category X drove 40% of total revenue, mainly in Q4') is just as important as the code itself, because the goal of analysis is a clear takeaway, not just a runnable notebook.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Documentation</h4><p style=\"margin:0 0 8px;\">Comment your code and, if using a Jupyter notebook, use markdown cells to explain each step in plain English. This makes the project reproducible by someone else (or by you, six months later) and is exactly the kind of practice expected in any real data team.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">A mini project is a rehearsal for real-world data work: define a question, load and clean the data, analyze it methodically, and communicate a clear insight at the end. The process matters as much as any individual line of code.</p>", "Design Principles": "<p class=\"ov\" style=\"margin:0 0 12px;\">Design principles are the underlying rules that separate an interface that feels intuitive and professional from one that feels confusing or amateurish. They apply regardless of the specific tool, platform, or visual style being used — they are about how humans perceive and process visual information.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Balance</h4><p style=\"margin:0 0 8px;\">Balance refers to how visual 'weight' (size, color intensity, density) is distributed across a layout. <b>Symmetric balance</b> mirrors elements evenly (formal, calm, sometimes static). <b>Asymmetric balance</b> uses different elements on each side that still feel evenly weighted overall (more dynamic and modern, but harder to get right).</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Contrast</h4><p style=\"margin:0 0 8px;\">Contrast — differences in size, color, weight, or spacing — is what draws the eye to what matters most. A bright, high-contrast call-to-action button on a muted background is a deliberate, well-known technique to guide user attention exactly where a designer wants it to go.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Visual Hierarchy</h4><p style=\"margin:0 0 8px;\">Hierarchy is the deliberate ordering of importance in a design: the biggest, boldest element should be the most important one, guiding the user's eye in a predictable path (often top-to-bottom, left-to-right in most Western reading patterns). Without a clear hierarchy, users don't know where to look first, and important actions get missed.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Alignment</h4><p style=\"margin:0 0 8px;\">Elements lined up to a consistent, invisible grid feel organized, intentional, and trustworthy; randomly placed elements feel messy and undermine credibility even if the individual elements are well designed. Most professional design tools (Figma, Adobe XD) have built-in grid and alignment guides specifically to enforce this.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Consistency and Repetition</h4><p style=\"margin:0 0 8px;\">Reusing the same colors, spacing values, icon style, and component patterns across every screen builds a coherent product that feels like one unified system rather than a patchwork of disconnected screens — and it makes the interface far easier and faster for users to learn.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Proximity</h4><p style=\"margin:0 0 8px;\">Related items should be placed close together, and unrelated items should have clear space between them. This is one of the simplest and most powerful principles: proximity alone communicates relationships between elements, often before the user even consciously reads any text.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">These principles work together, not in isolation — a strong design usually applies several at once (e.g. hierarchy created through a combination of size, contrast, and position). Learning to consciously 'see' these principles in existing apps you use daily is one of the fastest ways to internalize them.</p>", "Color Theory": "<p class=\"ov\" style=\"margin:0 0 12px;\">Color theory is the study of how colors interact, combine, and are perceived — and it directly affects how usable, accessible, and emotionally effective a digital interface is. Good color choices are never random; they follow deliberate, learnable rules.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">The Color Wheel</h4><p style=\"margin:0 0 8px;\">The color wheel organizes primary colors (red, blue, yellow), secondary colors (formed by mixing two primaries, e.g. orange), and tertiary colors around a circle. It is the foundation for every standard color scheme technique used in design.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Common Color Schemes</h4><p style=\"margin:0 0 8px;\"><b>Complementary</b> colors sit directly opposite each other on the wheel (e.g. blue and orange) and create high contrast and visual energy — good for calls-to-action. <b>Analogous</b> colors sit next to each other (e.g. blue, teal, green) and feel harmonious and calm — good for backgrounds and broad UI areas. <b>Monochromatic</b> schemes use different shades/tints of a single color for a clean, cohesive look.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Color Psychology</h4><p style=\"margin:0 0 8px;\">Colors carry cultural and psychological associations that designers use deliberately: blue often signals trust and calm (common in banking/tech apps), red signals urgency or passion (used sparingly, often for warnings or sales), green signals growth, success, or 'go' (confirmation states), and yellow signals optimism but also caution. These associations are not universal across all cultures, so context and audience matter.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Accessibility and Contrast</h4><p style=\"margin:0 0 8px;\">Text needs sufficient contrast against its background to remain readable, especially for users with visual impairments — the WCAG (Web Content Accessibility Guidelines) define minimum contrast ratios that professional design work is expected to meet. Relying on color alone to convey information (e.g. only red vs. green with no icon or label) also excludes colorblind users and should be avoided.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Building a UI Palette</h4><p style=\"margin:0 0 8px;\">A typical, disciplined UI color palette has: one primary brand color, one or two accent colors (for highlights/CTAs), a set of neutral grays (for text, backgrounds, borders), and dedicated semantic colors for success/warning/error states. Using too many unrelated colors is one of the most common mistakes in early design work — restraint almost always looks more professional.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Color is never purely decorative in good UI design — it communicates meaning, guides attention, and must remain accessible to all users. A small, disciplined, purposeful palette consistently outperforms a large, decorative one.</p>", "Typography": "<p class=\"ov\" style=\"margin:0 0 12px;\">Typography is the art and technique of arranging text to make it readable, accessible, and visually appropriate for its context. In digital design, typography choices affect not just aesthetics but comprehension speed and overall trust in a product.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Serif vs Sans-Serif</h4><p style=\"margin:0 0 8px;\">Serif fonts (with small decorative strokes, like Times New Roman) tend to feel traditional, formal, or editorial — commonly used in print and formal documents. Sans-serif fonts (clean, no strokes, like Helvetica or Inter) feel modern, clean, and are generally considered more legible on digital screens, which is why the vast majority of modern apps and websites default to sans-serif for UI text.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Font Pairing</h4><p style=\"margin:0 0 8px;\">A common, reliable rule is to use no more than two font families on one screen: one for headings (can have more personality) and one for body text (must prioritize readability above all else). Mixing many different fonts on one screen is one of the fastest ways to make a design look unprofessional and cluttered.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Establishing Hierarchy</h4><p style=\"margin:0 0 8px;\">Typographic hierarchy is built using size, weight (bold vs regular), and sometimes color — headings should be clearly, unmistakably distinct from subheadings, which should be clearly distinct from body text. A consistent type scale (e.g. 32px / 24px / 16px / 14px) applied across an entire product keeps this hierarchy predictable everywhere.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Line Height and Spacing</h4><p style=\"margin:0 0 8px;\">Line height (the vertical space between lines of text, also called 'leading') strongly affects readability — body text is generally most comfortable at around 1.4x to 1.6x the font size. Letter spacing (tracking) is usually left at default for body text but is sometimes slightly increased for all-caps headings to improve legibility.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Line Length</h4><p style=\"margin:0 0 8px;\">Lines of body text that are too long (over roughly 75 characters) force the eye to travel too far and lose its place when jumping to the next line; lines that are too short feel choppy and interrupt reading rhythm. This is why well-designed articles and blogs constrain their text column to a comfortable, moderate width rather than stretching it across a full wide screen.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Good typography is often invisible — readers don't consciously notice it, they just find the text effortless to read. Bad typography is the opposite: readers notice, feel friction, and often don't consciously know why.</p>", "Wireframing": "<p class=\"ov\" style=\"margin:0 0 12px;\">Wireframing is the process of laying out the basic structure of a screen — where things go, not what they look like — before investing time in visual design. It is one of the earliest, cheapest, and most important steps in a real UX design process.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Purpose of Wireframes</h4><p style=\"margin:0 0 8px;\">Wireframes let a designer (and a team) rapidly think through layout, content priority, and user flow, without getting distracted by colors, fonts, or images that are easy to get attached to and expensive to redo later. They force conversations about function and priority before form.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Low-Fidelity Wireframes</h4><p style=\"margin:0 0 8px;\">Low-fidelity wireframes use simple boxes, lines, and placeholder text (often literally 'Lorem ipsum' or 'Image here') to represent content, with no real colors or finished visuals. These can be sketched on paper in minutes, which makes them extremely fast to iterate on and easy to throw away without regret if an idea doesn't work.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">High-Fidelity Wireframes / Mockups</h4><p style=\"margin:0 0 8px;\">Once the basic structure and flow are agreed on, high-fidelity mockups add real colors, fonts, spacing, and actual content — this is much closer to (or identical to) the final visual design, and is what gets shown to stakeholders or developers as the 'source of truth' for building the real product.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">User Flow</h4><p style=\"margin:0 0 8px;\">Beyond a single screen, wireframing often maps the sequence of screens a user moves through to complete a task (e.g. sign up → verify email → complete profile → dashboard). Thinking through this flow early catches missing steps or confusing transitions long before any code is written.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Common Tools</h4><p style=\"margin:0 0 8px;\">Figma is currently the dominant industry-standard tool for both wireframing and full UI design, largely because it's browser-based and supports real-time collaboration. Other tools include Adobe XD and Balsamiq (which deliberately looks 'sketchy' to keep early feedback focused on structure, not visuals).</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Wireframing exists to make layout and flow decisions cheap to explore and cheap to change. Investing in visual polish before the underlying structure is solid is one of the most common — and most expensive — mistakes in design work.</p>", "Setting up Android Studio": "<p class=\"ov\" style=\"margin:0 0 12px;\">Android Studio is Google's official Integrated Development Environment (IDE) for building Android apps, built on JetBrains' IntelliJ IDEA platform. It bundles everything needed to write, test, and package an Android app in one tool.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Installation</h4><p style=\"margin:0 0 8px;\">Installing Android Studio also installs the Android SDK (Software Development Kit) — the collection of libraries, tools, and platform APIs an app needs to actually run on Android. The installer walks through choosing an SDK version, and additional versions can be added later through the SDK Manager to support different Android OS versions.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">The Android Virtual Device (AVD) Manager</h4><p style=\"margin:0 0 8px;\">Not every developer has ten different physical phones to test on. The AVD Manager lets you create emulators — virtual Android devices that run on your computer — configured with a specific screen size, Android version, and hardware profile, so you can test how an app behaves on many different devices without owning them.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Project Structure</h4><p style=\"margin:0 0 8px;\">A new project is scaffolded with a predictable structure: <code>MainActivity.kt</code> (the entry-point code for the first screen), the <code>res/layout</code> folder (XML files defining what each screen looks like), <code>res/values</code> (colors, strings, and style definitions kept centralized instead of hardcoded), and <code>AndroidManifest.xml</code> (a configuration file declaring the app's components, permissions, and metadata).</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Gradle</h4><p style=\"margin:0 0 8px;\">Gradle is the build system underneath every Android Studio project — it compiles Kotlin/Java code, resolves and downloads external libraries (dependencies), and packages everything into an installable APK or AAB file. Most day-to-day work with Gradle is just adding a dependency line to <code>build.gradle</code> and syncing, but understanding that it exists explains why projects sometimes need to 'sync' or 'rebuild' after changes.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Running an App</h4><p style=\"margin:0 0 8px;\">An app is run either on an emulator (via the AVD Manager) or on a real device connected via USB with 'Developer Options' and USB debugging enabled in the phone's settings. Android Studio compiles the code, installs it, and launches it automatically with a single Run button click.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Android Studio is a large, feature-rich IDE, but a beginner only needs a small, stable subset to get productive: creating a project, understanding the layout/code split, running on an emulator, and knowing that Gradle is quietly doing the build work behind the scenes.</p>", "Kotlin Basics": "<p class=\"ov\" style=\"margin:0 0 12px;\">Kotlin is the modern, official programming language for Android development, endorsed by Google as the preferred choice over the older Java. It is designed to be more concise, safer (fewer crash-prone patterns), and fully interoperable with existing Java code.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Variables</h4><p style=\"margin:0 0 8px;\">Kotlin has two ways to declare a variable: <code>val</code> for a value that is assigned once and never changed (similar to a constant — preferred by default), and <code>var</code> for a variable that can be reassigned later. Preferring <code>val</code> wherever possible is considered idiomatic Kotlin and reduces bugs caused by unexpected mutation.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Null Safety</h4><p style=\"margin:0 0 8px;\">One of Kotlin's most important features: a normal type like <code>String</code> can never hold null — the compiler simply won't allow it, catching a huge category of bugs before the app ever runs. If a value genuinely might be absent, it must be explicitly marked nullable with a question mark, <code>String?</code>, and the compiler then forces you to handle the null case safely (e.g. with <code>?.</code> safe calls or <code>?:</code> the 'Elvis operator' for defaults) before using it.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Functions</h4><p style=\"margin:0 0 8px;\">Functions are declared with <code>fun</code>: <code>fun greet(name: String): String { return \"Hi $name\" }</code>. Kotlin supports string templates directly inside strings (<code>$name</code> or <code>${expression}</code>), removing the need for manual string concatenation that clutters code in many other languages.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Classes and Data Classes</h4><p style=\"margin:0 0 8px;\">A regular class groups properties and behavior together, similar to other object-oriented languages. Kotlin also offers a special shortcut, <b>data classes</b> (<code>data class User(val name: String, val age: Int)</code>), which automatically generate useful boilerplate (equality checks, string representation, copying) — extremely common for representing simple data models like a user, product, or API response.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Control Flow and Lambdas</h4><p style=\"margin:0 0 8px;\">Kotlin's <code>if</code>/<code>else</code>, <code>when</code> (a more powerful version of switch), and loops work similarly to other C-family languages. Kotlin also supports lambda expressions — small, inline anonymous functions like <code>{ x -&gt; x * 2 }</code> — used constantly for things like button click handlers and processing lists concisely.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Kotlin's core selling points for Android development are conciseness (less boilerplate than Java) and null safety (a whole class of app crashes essentially eliminated at compile time). These two features alone are why most new Android projects are written in Kotlin today.</p>", "Activities & Layouts": "<p class=\"ov\" style=\"margin:0 0 12px;\">An Activity represents a single, focused screen in an Android app with a user interface — think of it as one page in a mobile app. Most simple apps have just a few Activities; more complex apps built with modern patterns may use a single Activity with multiple internal Fragments, but understanding the Activity is still foundational.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">The Activity Lifecycle</h4><p style=\"margin:0 0 8px;\">Android manages an Activity through a defined lifecycle of callback methods the system calls automatically: <code>onCreate()</code> (the screen is being set up — this is where most setup code lives), <code>onStart()</code>/<code>onResume()</code> (the screen becomes visible/interactive), and <code>onPause()</code>/<code>onStop()</code>/<code>onDestroy()</code> (the screen is being hidden or closed). Understanding this lifecycle is essential for correctly managing resources — e.g. releasing a camera or pausing a video when the user leaves a screen.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">XML Layouts</h4><p style=\"margin:0 0 8px;\">The visual structure of a screen is defined declaratively in an XML file under <code>res/layout</code>, separate from the Kotlin logic — this mirrors the HTML/JavaScript separation from web development. This XML file describes what views exist and how they're arranged, while the Activity's Kotlin code handles behavior and logic.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Layout Containers</h4><p style=\"margin:0 0 8px;\"><b>LinearLayout</b> arranges children in a single row or column (simple, but limited for complex screens). <b>RelativeLayout</b> positions children relative to each other or the parent. <b>ConstraintLayout</b> — the modern, Google-recommended default — positions views using flexible constraints (e.g. 'this button's top is 16dp below that image'), which adapts well across different screen sizes without deeply nested layouts.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Views</h4><p style=\"margin:0 0 8px;\">Views are the actual UI building blocks placed inside a layout: <code>TextView</code> (displays text), <code>Button</code>, <code>EditText</code> (text input field), <code>ImageView</code>, and many more. Each has XML attributes controlling its size, position, text, and appearance.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Connecting XML to Code</h4><p style=\"margin:0 0 8px;\">To make a view usable in Kotlin code, it needs to be referenced — traditionally with <code>findViewById&lt;Button&gt;(R.id.myButton)</code>, though modern projects increasingly use <b>View Binding</b>, a feature that generates type-safe references to every view automatically, reducing a common category of errors (using the wrong type, or a typo in an id).</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Every Android screen is a partnership between an XML layout (structure) and an Activity (behavior and lifecycle management) — understanding both halves, and how they connect, is fundamental to all Android UI development.</p>", "Building Your First App": "<p class=\"ov\" style=\"margin:0 0 12px;\">Building a first working app is where the separate concepts — Kotlin syntax, layouts, and the Activity lifecycle — come together into one functioning whole. It typically starts as a deliberately small app (e.g. a simple counter or calculator) to keep the focus on the end-to-end workflow rather than complex features.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Connecting UI to Logic</h4><p style=\"margin:0 0 8px;\">The core pattern for any interactive app: get a reference to a view (via <code>findViewById</code> or View Binding), then attach behavior to it. For a button, that means: <code>button.setOnClickListener { /* code to run on click */ }</code> — this single pattern powers the vast majority of simple app interactions.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Reading and Displaying Data</h4><p style=\"margin:0 0 8px;\">A typical simple flow is: read text from an <code>EditText</code> with <code>.text.toString()</code>, process it in Kotlin (e.g. do a calculation), and display a result by updating a <code>TextView</code>'s text property. This read → process → display loop is the backbone of almost every basic interactive screen.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">User Feedback</h4><p style=\"margin:0 0 8px;\"><code>Toast.makeText(context, \"Message\", Toast.LENGTH_SHORT).show()</code> displays a small, temporary pop-up message — the simplest way to give the user quick feedback (e.g. confirming an action succeeded) without interrupting their flow with a full dialog.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Testing on Emulator or Device</h4><p style=\"margin:0 0 8px;\">Running the app (via the emulator or a real device with USB debugging) after every meaningful change catches problems early. Reading Logcat (Android Studio's live log output) is the standard way to diagnose crashes — it shows the exact error and the line of code that caused it.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">From Working App to Shareable App</h4><p style=\"margin:0 0 8px;\">Once the app builds, runs, and works as intended, Android Studio can generate a signed APK or AAB (Android App Bundle) file — the format needed to install the app on other devices directly, or to eventually publish it to the Google Play Store.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">A first working app, however small, proves out the complete Android development loop: layout → logic → connecting the two → testing → packaging. Every larger, more complex Android app is fundamentally built from many more instances of this exact same loop.</p>", "Intro to Digital Marketing": "<p class=\"ov\" style=\"margin:0 0 12px;\">Digital marketing is the promotion of products, services, or brands through online channels such as search engines, social media, email, websites, and mobile apps. Unlike traditional marketing (TV, newspapers, hoardings), it lets a business reach a precisely targeted audience and measure the result of every rupee spent.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Why It Matters</h4><p style=\"margin:0 0 8px;\">Most customers now research a product online before buying it. A business that is invisible online is invisible to a large part of its market. Digital marketing is also affordable: a small business can start with a very small budget, unlike a TV advertisement that needs a large upfront cost.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">The Marketing Funnel</h4><p style=\"margin:0 0 8px;\">The funnel describes the customer journey: <b>Awareness</b> (the person discovers the brand), <b>Interest</b> (they learn more), <b>Consideration</b> (they compare options), <b>Conversion</b> (they buy or sign up), and <b>Loyalty</b> (they return and recommend). Different content and channels work best at each stage, for example blog posts and social media for awareness, and email offers for conversion.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Main Channels</h4><p style=\"margin:0 0 8px;\"><b>SEO</b> improves organic (unpaid) search ranking. <b>SEM / PPC</b> means paid search ads where you pay per click. <b>Social Media Marketing</b> builds audience on platforms like Instagram and LinkedIn. <b>Email Marketing</b> sends messages directly to subscribers. <b>Content Marketing</b> creates useful blogs, videos, and guides that attract customers. <b>Affiliate Marketing</b> pays partners a commission for sales they bring.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Measuring Results</h4><p style=\"margin:0 0 8px;\">Digital marketing is highly measurable. Important metrics include <b>impressions</b> (how many times content was shown), <b>CTR</b> (click-through rate: clicks divided by impressions), <b>conversion rate</b> (visitors who complete the goal), <b>CPC</b> (cost per click), and <b>ROI</b> (return on investment). Tools like Google Analytics show where visitors come from and what they do on a site.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Building a Strategy</h4><p style=\"margin:0 0 8px;\">A good strategy answers four questions before any content is created: who is the target audience, what is the goal (for example, 500 signups this month), which channels will be used, and what is the budget. Without clear goals, it is impossible to say whether a campaign worked.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Digital marketing combines multiple channels, guided by a funnel and measured by data. Success comes from knowing your audience, choosing channels deliberately, and tracking results so the strategy can be improved continuously.</p>", "SEO Basics": "<p class=\"ov\" style=\"margin:0 0 12px;\">SEO (Search Engine Optimization) is the practice of improving a website so that it appears higher in unpaid search results on Google and other search engines. Higher ranking means more visitors without paying for each click, which is why SEO is one of the most valuable long-term marketing skills.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">How Search Engines Work</h4><p style=\"margin:0 0 8px;\">Search engines use <b>crawlers</b> (bots) to discover pages by following links, then <b>index</b> the content into a huge database. When someone searches, the engine <b>ranks</b> indexed pages by relevance and quality. Your job in SEO is to make your pages easy to crawl, clearly relevant to a topic, and trustworthy.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Keyword Research</h4><p style=\"margin:0 0 8px;\">Keywords are the words people type into a search box. Keyword research finds which terms your audience actually uses, how often they are searched, and how hard it is to rank for them. Tools such as Google Keyword Planner help. Long-tail keywords (longer, specific phrases like 'best budget laptop for students') have less competition and often higher buying intent.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">On-Page SEO</h4><p style=\"margin:0 0 8px;\">On-page SEO covers what you control on the page itself: a clear <b>title tag</b> containing the main keyword, a compelling <b>meta description</b>, proper heading structure (one h1, then h2/h3), descriptive image alt text, short readable URLs, and genuinely helpful content that answers the searcher's question. Internal links between your own pages also help search engines understand your site.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Off-Page SEO</h4><p style=\"margin:0 0 8px;\">Off-page SEO is mostly about <b>backlinks</b>: links from other websites to yours. Search engines treat quality backlinks as votes of trust. One link from a respected site is worth more than many links from low-quality sites. Earning backlinks usually means creating content worth referencing, such as original research or genuinely useful guides.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Technical SEO</h4><p style=\"margin:0 0 8px;\">Technical SEO ensures the site works well for both users and crawlers: fast loading speed, mobile-friendly design, secure HTTPS, a sitemap.xml file, and no broken links. Since most searches now happen on phones, Google mainly uses the mobile version of a site for ranking.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Measuring SEO</h4><p style=\"margin:0 0 8px;\">Google Search Console shows which queries bring visitors, your average ranking position, and any crawling problems. SEO is a long-term effort: results usually take weeks or months, so patience and consistent improvement matter more than quick tricks.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">SEO rests on three pillars: great content targeted to real keywords (on-page), trust signals from other sites (off-page), and a technically healthy website. Avoid shortcuts like keyword stuffing, which search engines penalize.</p>", "Social Media Strategy": "<p class=\"ov\" style=\"margin:0 0 12px;\">A social media strategy is a plan for how a brand will use social platforms to reach its goals. Posting randomly is not a strategy; a real one defines the audience, goals, platforms, content types, and how success will be measured.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Set Clear Goals</h4><p style=\"margin:0 0 8px;\">Goals should be specific and measurable, such as 'grow followers by 20% in three months' or 'get 100 website visits per week from Instagram'. Common goals are brand awareness, engagement, lead generation, and customer support. The goal decides which metrics you track.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Know Your Audience</h4><p style=\"margin:0 0 8px;\">Study who your customers are: age, interests, location, and which platforms they use daily. Creating a simple audience persona (for example, 'college student, 19 to 24, uses Instagram and YouTube') keeps content relevant instead of generic.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Choose the Right Platforms</h4><p style=\"margin:0 0 8px;\">You do not need every platform. <b>LinkedIn</b> suits professional and B2B content. <b>Instagram</b> suits visual brands and short videos. <b>YouTube</b> suits tutorials and long-form video. <b>X (Twitter)</b> suits news and quick conversation. <b>Facebook</b> reaches broad and older audiences. It is better to do two platforms well than six poorly.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Content Types and Calendar</h4><p style=\"margin:0 0 8px;\">Mix content types: educational posts, behind-the-scenes, customer stories, short videos, polls, and occasional promotions. A <b>content calendar</b> plans what to post and when, so posting stays consistent. A common guideline is the 80/20 rule: 80% helpful or entertaining content, 20% direct promotion.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Engagement</h4><p style=\"margin:0 0 8px;\">Algorithms reward interaction. Reply to comments, ask questions, run polls, and respond to messages quickly. Engagement rate (likes, comments, shares divided by reach) is usually a better health measure than raw follower count.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Paid Social and Analytics</h4><p style=\"margin:0 0 8px;\">Paid ads let you target by age, interest, location, and behavior. Every platform provides analytics showing reach, engagement, clicks, and best posting times. Review these regularly, keep what works, and drop what does not. Testing two versions of a post (A/B testing) is a simple way to learn what your audience prefers.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">A strong social media strategy connects goals, audience, platform choice, consistent valuable content, real engagement, and regular measurement. Consistency and relevance beat volume.</p>", "Variables & Data Types": "<p class=\"ov\" style=\"margin:0 0 12px;\">C is a statically typed language: every variable must be declared with a data type before it is used. The type tells the compiler how much memory to reserve and how to interpret the bits stored there. This is the foundation of every C program.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Declaring and Initializing</h4><p style=\"margin:0 0 8px;\">Declaration: <code>int age;</code>. Initialization: <code>int age = 21;</code>. Multiple variables of the same type can be declared together: <code>int a = 1, b = 2;</code>. An uninitialized local variable contains a garbage value, so always initialize before use. Variable names are case-sensitive, cannot start with a digit, and cannot be keywords like <code>int</code> or <code>while</code>.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Basic Data Types</h4><p style=\"margin:0 0 8px;\"><b>int</b> stores whole numbers (typically 4 bytes). <b>float</b> stores decimals with about 6 digits of precision (4 bytes). <b>double</b> stores decimals with about 15 digits of precision (8 bytes). <b>char</b> stores a single character in 1 byte, for example <code>char grade = 'A';</code>. Exact sizes depend on the system, and you can check with <code>sizeof(int)</code>.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Type Modifiers</h4><p style=\"margin:0 0 8px;\">Modifiers change range or size: <code>short</code>, <code>long</code>, <code>signed</code>, and <code>unsigned</code>. An <code>unsigned int</code> stores only non-negative numbers but can hold a larger positive range than a signed int of the same size.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Constants</h4><p style=\"margin:0 0 8px;\">Values that must not change can be declared with <code>const int MAX = 100;</code> or with a preprocessor macro <code>#define MAX 100</code>. Using named constants instead of raw numbers makes code readable and easy to update.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Input and Output</h4><p style=\"margin:0 0 8px;\"><code>printf()</code> prints output using format specifiers: <code>%d</code> for int, <code>%f</code> for float, <code>%lf</code> for double (in scanf), <code>%c</code> for char, <code>%s</code> for strings. <code>scanf()</code> reads input and needs the address of the variable: <code>scanf(\"%d\", &amp;age);</code>. Forgetting the <code>&amp;</code> is a very common beginner bug.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Type Conversion</h4><p style=\"margin:0 0 8px;\">Mixing types causes implicit conversion, for example <code>int</code> to <code>float</code> in an expression. Integer division discards the decimal part: <code>5 / 2</code> gives 2, but <code>5 / 2.0</code> gives 2.5. Explicit casting, <code>(float)a / b</code>, gives you control.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Choose the right type for the data, always initialize variables, use the correct format specifier in printf and scanf, and watch out for integer division. These basics prevent a large share of early bugs.</p>", "Loops & Conditions": "<p class=\"ov\" style=\"margin:0 0 12px;\">Conditions let a program make decisions, and loops let it repeat work. Together with variables, they let you express almost any algorithm.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">if, else if, else</h4><p style=\"margin:0 0 8px;\"><code>if (marks &gt;= 40) { ... } else { ... }</code> runs one block or the other. Chain conditions with <code>else if</code>. Combine tests with <code>&amp;&amp;</code> (and), <code>||</code> (or), and <code>!</code> (not). Remember that <code>=</code> assigns while <code>==</code> compares; writing <code>if (x = 5)</code> is a classic bug.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">switch</h4><p style=\"margin:0 0 8px;\"><code>switch</code> compares one value against many constants using <code>case</code> labels. Each case usually ends with <code>break;</code>, otherwise execution 'falls through' into the next case. <code>default</code> handles anything unmatched. switch works with int and char values, not strings or floats.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">for Loop</h4><p style=\"margin:0 0 8px;\">Best when the number of repetitions is known: <code>for (int i = 0; i &lt; 5; i++) { printf(\"%d\\n\", i); }</code>. It has three parts: initialization, condition, and update. The loop runs while the condition is true.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">while and do-while</h4><p style=\"margin:0 0 8px;\"><code>while (condition) { ... }</code> checks the condition <b>before</b> each iteration, so it may run zero times. <code>do { ... } while (condition);</code> checks <b>after</b>, so it always runs at least once, which suits menu programs and input validation.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">break and continue</h4><p style=\"margin:0 0 8px;\"><code>break</code> exits the nearest loop (or switch) immediately. <code>continue</code> skips the rest of the current iteration and moves to the next one. Nested loops, a loop inside a loop, are used for patterns and tables; the inner loop completes fully for each pass of the outer loop.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Common Mistakes</h4><p style=\"margin:0 0 8px;\">Infinite loops from forgetting to update the counter, off-by-one errors (using <code>&lt;=</code> instead of <code>&lt;</code>), and a stray semicolon after the loop header, <code>for(...);</code>, which makes the loop body empty.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Use for when the count is known, while when it depends on a condition, and do-while when the body must run once. Trace loops by hand with a small example to verify the logic.</p>", "Functions": "<p class=\"ov\" style=\"margin:0 0 12px;\">A function is a named, reusable block of code that performs a specific task. Breaking a program into functions makes it shorter, easier to read, easier to test, and avoids repeating the same code.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Syntax</h4><p style=\"margin:0 0 8px;\"><code>return_type name(parameter_list) { body; return value; }</code>. Example: <code>int add(int a, int b) { return a + b; }</code>. It is called as <code>int s = add(3, 4);</code>. A function returning nothing uses <code>void</code>.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Declaration, Definition, Call</h4><p style=\"margin:0 0 8px;\">The <b>declaration (prototype)</b> tells the compiler the function's name, parameter types, and return type: <code>int add(int, int);</code>. It is placed before <code>main()</code> if the full <b>definition</b> comes after main. The <b>call</b> is where the function is used. Without a prototype, the compiler may not recognize the function.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Parameters and Arguments</h4><p style=\"margin:0 0 8px;\">Parameters are the variables in the definition; arguments are the actual values passed in the call. C uses <b>call by value</b>: the function receives a copy, so changing a parameter inside does not change the caller's variable. To modify the original, pass its address using pointers (call by reference).</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Return Values</h4><p style=\"margin:0 0 8px;\"><code>return</code> sends a value back and ends the function immediately. A function can have several return statements, but returns exactly one value. main() itself returns int, where <code>return 0;</code> means success.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Scope and Lifetime</h4><p style=\"margin:0 0 8px;\">Variables declared inside a function are <b>local</b>: they exist only while the function runs. Global variables are visible everywhere but make code harder to reason about, so use them sparingly. A <code>static</code> local variable keeps its value between calls.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Recursion</h4><p style=\"margin:0 0 8px;\">A function that calls itself is recursive. It needs a <b>base case</b> that stops the recursion and a step that moves toward it. Classic example: factorial, <code>fact(n) = n * fact(n-1)</code> with <code>fact(0) = 1</code>. Missing the base case causes a stack overflow.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Design small functions that do one job, declare prototypes, remember call by value, and use recursion only when the problem is naturally recursive.</p>", "Arrays & Pointers": "<p class=\"ov\" style=\"margin:0 0 12px;\">Arrays let you store many values of one type under a single name. Pointers store memory addresses. In C the two are closely connected, and understanding them is what separates basic from confident C programming.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Arrays</h4><p style=\"margin:0 0 8px;\">Declaration: <code>int marks[5];</code> or with values <code>int marks[5] = {70, 80, 90, 60, 75};</code>. Elements are accessed by index starting at <b>0</b>, so the valid indices are 0 to 4. They sit in contiguous memory. C does <b>not</b> check bounds: <code>marks[5]</code> is out of range and causes undefined behavior.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Looping Over Arrays</h4><p style=\"margin:0 0 8px;\">Use a for loop: <code>for (int i = 0; i &lt; 5; i++) sum += marks[i];</code>. Typical tasks are finding the sum, maximum, minimum, searching for a value, and sorting (for example bubble sort). Two-dimensional arrays, <code>int m[3][3];</code>, represent matrices and use nested loops.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Strings</h4><p style=\"margin:0 0 8px;\">A string in C is a char array ending with the null character <code>'\\0'</code>: <code>char name[] = \"Angad\";</code>. Library functions in <code>&lt;string.h&gt;</code> such as <code>strlen</code>, <code>strcpy</code>, <code>strcmp</code>, and <code>strcat</code> operate on them. Strings cannot be compared with <code>==</code>; use <code>strcmp</code>.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Pointers</h4><p style=\"margin:0 0 8px;\">A pointer holds the address of another variable. <code>int x = 10; int *p = &amp;x;</code>. Here <code>&amp;x</code> is the address of x, and <code>*p</code> (dereferencing) is the value stored at that address. Changing <code>*p = 20;</code> changes x itself. Always initialize pointers; an uninitialized ('wild') pointer or a NULL dereference crashes the program.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Arrays and Pointers Together</h4><p style=\"margin:0 0 8px;\">The array name acts like a pointer to its first element: <code>arr</code> is the same as <code>&amp;arr[0]</code>, and <code>arr[i]</code> is equivalent to <code>*(arr + i)</code>. <b>Pointer arithmetic</b>: <code>p + 1</code> moves forward by the size of the pointed type, which is why traversing arrays with pointers works.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Pointers and Functions</h4><p style=\"margin:0 0 8px;\">Passing an array to a function passes its address, so the function can modify the original elements. Passing <code>&amp;x</code> to a function lets it change x (this is how <code>scanf</code> works). A classic example is a <code>swap(int *a, int *b)</code> function.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Dynamic Memory</h4><p style=\"margin:0 0 8px;\"><code>malloc(size)</code> allocates memory at runtime and returns a pointer; <code>free(ptr)</code> releases it. Forgetting to free causes memory leaks, and using memory after freeing is a serious bug.</p><h4 style=\"margin:16px 0 6px;color:var(--text);font-size:14.5px;\">Key Takeaways</h4><p style=\"margin:0 0 8px;\">Remember zero-based indexing, no automatic bounds checking, that strings end with '\\0', and that * dereferences while &amp; takes an address. Practice with small programs until the pointer picture is clear.</p>"};

  function mkLessons(topics){
    return topics.map((t,i)=>({id:uid('les'), title:t, type: i%3===2?'notes':'video',
      duration: i%3===2 ? '' : (8+i*2)+' min',
      content: LESSON_NOTES[t] || (i%3===2 ? `Detailed notes covering: ${t}. Read through the key concepts and examples before attempting the quiz.` : `Video lecture: ${t}. Watch the full lecture, then mark this lesson as completed.`) }));
  }
  function mkQuiz(qs){ return qs.map(q=>({id:uid('q'), q:q.q, options:q.options, answer:q.answer})); }

  const c1 = {id:uid('crs'), title:'Complete Web Development Bootcamp', instructorId:'u_inst1', instructorName:'Arjun Deshmukh',
    category:'Web Development', description:'Learn HTML, CSS, JavaScript and build real projects from scratch.',
    level:'Beginner', duration:'8 weeks', thumb:'💻', status:'approved',
    youtubeUrl:'https://youtube.com/playlist?list=PLu0W_9lII9agq5TrH9XLIKQvv0iaF2X3w',
    lessons: mkLessons(['Introduction to HTML','Styling with CSS','JavaScript Basics','DOM Manipulation','Building a Project']),
    quiz: mkQuiz([
      {q:'Which tag is used to create a hyperlink in HTML?', options:['<link>','<a>','<href>','<nav>'], answer:1},
      {q:'CSS stands for?', options:['Colorful Style Sheets','Cascading Style Sheets','Creative Style System','Computer Style Sheets'], answer:1},
      {q:'Which keyword declares a block-scoped variable in JS?', options:['var','let','func','global'], answer:1},
      {q:'document.getElementById() returns a?', options:['Array','String','DOM Element','Number'], answer:2},
      {q:'Which tag is used for the largest heading in HTML?', options:['<h6>','<heading>','<h1>','<head>'], answer:2},
      {q:'Which CSS property changes text color?', options:['font-color','text-color','color','fg-color'], answer:2},
      {q:'Which symbol is used for ID selector in CSS?', options:['.','#','*','@'], answer:1},
      {q:'Which JS method converts a string to an integer?', options:['parseInt()','toInt()','Number.string()','int()'], answer:0},
      {q:'Which HTML attribute specifies an image source?', options:['href','src','alt','link'], answer:1},
      {q:'Which operator checks both value and type in JS?', options:['==','=','===','!='], answer:2},
      {q:'Flexbox is enabled using which CSS property value?', options:['display:flex','position:flex','flex:box','layout:flex'], answer:0},
      {q:'Which event fires when a user clicks a button?', options:['onhover','onclick','onchange','onsubmit'], answer:1},
    ])};

  const c2 = {id:uid('crs'), title:'Python for Data Science', instructorId:'u_inst2', instructorName:'Meera Nair',
    category:'Data Science', description:'Master Python, Pandas and NumPy for real-world data analysis.',
    level:'Intermediate', duration:'6 weeks', thumb:'📊', status:'approved',
    youtubeUrl:'https://www.youtube.com/live/nHAPcZRg9VM',
    lessons: mkLessons(['Python Syntax Refresher','NumPy Arrays','Pandas DataFrames','Data Visualization','Mini Project']),
    quiz: mkQuiz([
      {q:'Which library is primarily used for dataframes in Python?', options:['NumPy','Pandas','Matplotlib','Flask'], answer:1},
      {q:'What does len() return for a list?', options:['Sum','Number of elements','Type','Memory size'], answer:1},
      {q:'Which symbol starts a comment in Python?', options:['//','#','--','/*'], answer:1},
      {q:'Which NumPy function creates an array of zeros?', options:['np.zeros()','np.empty()','np.null()','np.blank()'], answer:0},
      {q:'Which method reads a CSV file in Pandas?', options:['pd.load_csv()','pd.read_csv()','pd.open_csv()','pd.import_csv()'], answer:1},
      {q:'Which data type is immutable in Python?', options:['List','Dictionary','Tuple','Set'], answer:2},
      {q:'Which library is commonly used for plotting graphs?', options:['Matplotlib','Requests','Flask','Django'], answer:0},
      {q:'What does df.head() show by default?', options:['Last 5 rows','First 5 rows','All rows','Column names'], answer:1},
      {q:'Which keyword is used to define a function in Python?', options:['func','def','function','define'], answer:1},
      {q:'Which operator is used for exponentiation in Python?', options:['^','**','exp()','pow'], answer:1},
      {q:'Which method removes missing values in Pandas?', options:['dropna()','removena()','clearna()','delna()'], answer:0},
    ])};

  const c3 = {id:uid('crs'), title:'UI/UX Design Fundamentals', instructorId:'u_inst2', instructorName:'Meera Nair',
    category:'Design', description:'Learn the principles of great design and prototyping with real tools.',
    level:'Beginner', duration:'4 weeks', thumb:'🎨', status:'approved',
    youtubeUrl:'https://youtube.com/playlist?list=PLdvOfoe7PXT0ouChAnR1nHlT8BJIo5hP_',
    lessons: mkLessons(['Design Principles','Color Theory','Typography','Wireframing']),
    quiz: mkQuiz([
      {q:'What does UX stand for?', options:['User Experience','User Extension','Unified Xperience','User Exchange'], answer:0},
      {q:'Which is a common wireframing tool?', options:['Figma','Excel','Notepad','Photoshop only'], answer:0},
      {q:'What does UI stand for?', options:['User Interface','Unified Icon','User Index','Universal Interface'], answer:0},
      {q:'Complementary colors sit where on the color wheel?', options:['Next to each other','Opposite each other','Same spot','Random'], answer:1},
      {q:'A low-fidelity mockup is usually called a?', options:['Prototype','Wireframe','Final design','Style guide'], answer:1},
      {q:'Which font category has decorative strokes at letter ends?', options:['Serif','Sans-serif','Monospace','Script'], answer:0},
      {q:'Consistent spacing and alignment in design follows which principle?', options:['Contrast','Proximity/Alignment','Randomness','Saturation'], answer:1},
      {q:'A style guide mainly documents a product\'s?', options:['Server code','Visual design rules','Database schema','Marketing budget'], answer:1},
      {q:'What is the purpose of user personas?', options:['Track bugs','Represent target users','Manage servers','Write code'], answer:1},
      {q:'High contrast between text and background improves?', options:['Load speed','Readability','File size','SEO only'], answer:1},
    ])};

  const c4 = {id:uid('crs'), title:'Android App Development', instructorId:'u_inst1', instructorName:'Arjun Deshmukh',
    category:'Mobile Development', description:'Build native Android apps using Kotlin and Android Studio.',
    level:'Intermediate', duration:'10 weeks', thumb:'📱', status:'pending',
    lessons: mkLessons(['Setting up Android Studio','Kotlin Basics','Activities & Layouts','Building Your First App']),
    quiz: mkQuiz([
      {q:'Android apps are primarily written in?', options:['Kotlin/Java','PHP','Ruby','Swift'], answer:0},
      {q:'Which file defines an Android app\'s permissions and components?', options:['build.gradle','AndroidManifest.xml','res/layout.xml','settings.json'], answer:1},
      {q:'Which component represents a single screen in Android?', options:['Service','Activity','Intent','Provider'], answer:1},
      {q:'XML files for UI layouts live in which folder?', options:['res/layout','src/main','assets/ui','res/values'], answer:0},
      {q:'Which class is used to navigate between screens?', options:['Intent','Fragmentizer','Router','Navigator'], answer:0},
      {q:'Which tool is the official Android IDE?', options:['Xcode','Android Studio','Eclipse','VS Code only'], answer:1},
      {q:'Which Kotlin keyword declares an immutable variable?', options:['var','val','let','const var'], answer:1},
      {q:'Which component runs long tasks in the background?', options:['Activity','Service','Layout','View'], answer:1},
      {q:'The build system used in Android projects is?', options:['Maven only','Gradle','Make','Webpack'], answer:1},
      {q:'Which layout arranges views in rows and columns?', options:['LinearLayout','GridLayout','TextView','ImageView'], answer:1},
    ])};

  const c5 = {id:uid('crs'), title:'Digital Marketing Essentials', instructorId:'u_inst2', instructorName:'Meera Nair',
    category:'Business', description:'Learn SEO, social media marketing and content strategy.',
    level:'Beginner', duration:'5 weeks', thumb:'📈', status:'approved',
    youtubeUrl:'https://youtu.be/qnBhOVH1QQ8',
    lessons: mkLessons(['Intro to Digital Marketing','SEO Basics','Social Media Strategy']),
    quiz: mkQuiz([
      {q:'SEO stands for?', options:['Search Engine Optimization','Site Engine Order','Search Element Order','Server Engine Optimization'], answer:0},
      {q:'PPC advertising means you pay per?', options:['Impression','Click','Hour','Follower'], answer:1},
      {q:'Which metric shows % of visitors who leave after one page?', options:['Bounce rate','CTR','CPC','ROI'], answer:0},
      {q:'Which platform is primarily used for professional B2B marketing?', options:['LinkedIn','Snapchat','TikTok','Pinterest'], answer:0},
      {q:'CTR stands for?', options:['Click Through Rate','Content Traffic Report','Customer Trust Ratio','Cost To Revenue'], answer:0},
      {q:'Backlinks mainly help improve a site\'s?', options:['Server speed','Search ranking','Ad budget','Font size'], answer:1},
      {q:'An email list opt-in form is used to collect?', options:['Passwords','Leads/subscribers','Payments','Reviews'], answer:1},
      {q:'Which is a paid social media ad model?', options:['Organic reach','Sponsored posts','Hashtags','Comments'], answer:1},
      {q:'Keyword research helps identify what users?', options:['Purchase directly','Search for online','Complain about','Unfollow'], answer:1},
      {q:'A/B testing is used to compare two versions of a?', options:['Server','Webpage/ad','Database','Router'], answer:1},
      {q:'ROI stands for?', options:['Return On Investment','Rate Of Interest','Reach Of Impressions','Ratio Of Income'], answer:0},
    ])};

  const c6 = {id:uid('crs'), title:'Programming Fundamentals with C', instructorId:'u_inst1', instructorName:'Arjun Deshmukh',
    category:'Programming Basics', description:'Build a strong foundation in programming logic using C.',
    level:'Beginner', duration:'6 weeks', thumb:'🖥️', status:'approved',
    youtubeUrl:'https://youtube.com/playlist?list=PLu0W_9lII9aiXlHcLx-mDH1Qul38wD3aR',
    lessons: mkLessons(['Variables & Data Types','Loops & Conditions','Functions','Arrays & Pointers']),
    quiz: mkQuiz([
      {q:'Which header file is needed for printf()?', options:['<stdlib.h>','<stdio.h>','<string.h>','<math.h>'], answer:1},
      {q:'Which data type stores decimal numbers in C?', options:['int','float','char','short'], answer:1},
      {q:'Which loop always executes at least once?', options:['for','while','do-while','if'], answer:2},
      {q:'Which operator is used to get a variable\'s memory address?', options:['*','&','#','%'], answer:1},
      {q:'An array index in C starts from?', options:['1','-1','0','depends on compiler'], answer:2},
      {q:'Which keyword is used to exit a loop early?', options:['exit','stop','break','return'], answer:2},
      {q:'Which function is used to allocate memory dynamically?', options:['malloc()','alloc()','new()','create()'], answer:0},
      {q:'A function that calls itself is called?', options:['Recursive function','Inline function','Static function','Virtual function'], answer:0},
      {q:'Which symbol marks the end of a statement in C?', options:[':',';','.',','], answer:1},
      {q:'What does \'char\' data type store?', options:['A single character','A whole number','A decimal','A boolean'], answer:0},
      {q:'Which operator checks equality in C?', options:['=','==','equals','==='], answer:1},
    ])};

  db.courses = [c1,c2,c3,c4,c5,c6];

  // seed enrollment for demo student
  db.enrollments.push({id:uid('enr'), studentId:'u_stu1', courseId:c1.id, enrolledAt: now-1000*60*60*24*10,
    completedLessons:[c1.lessons[0].id, c1.lessons[1].id], lastLesson:c1.lessons[1].id, quizScore:null, certificateIssued:false});
  db.enrollments.push({id:uid('enr'), studentId:'u_stu1', courseId:c2.id, enrolledAt: now-1000*60*60*24*4,
    completedLessons:[], lastLesson:null, quizScore:null, certificateIssued:false});

  db.notifications.push({id:uid('ntf'), userId:'u_stu1', message:'Welcome to EduSphere! Start learning today.', ts: now-1000*60*60*24*10, read:false});

  /* Auto-seeded assignments per course & per topic */
  const COURSE_ASSIGNMENTS = {"c1": {"title": "Capstone: Build a Personal Portfolio Website", "desc": "Using everything from this course, build a 3-section personal portfolio website (Home, About, Projects) with semantic HTML, a responsive CSS layout (Flexbox/Grid), and at least one interactive JavaScript feature (e.g. a working contact form validation or a dark/light mode toggle). Submit your code as a zip or a live link.", "marks": 100, "days": 14}, "c2": {"title": "Capstone: Exploratory Data Analysis Mini-Report", "desc": "Pick any public CSV dataset (e.g. from Kaggle), load it with Pandas, clean it, and answer 2-3 analytical questions using groupby/filtering. Create at least 2 Matplotlib charts and write a short summary (150-200 words) of your findings.", "marks": 100, "days": 14}, "c3": {"title": "Capstone: Redesign One Screen of an Existing App", "desc": "Choose any app or website you use daily and redesign ONE screen applying design principles, a deliberate color scheme, and improved typography. Submit a wireframe (low-fi) and a final high-fidelity mockup (Figma link or exported image), with a short note on what you changed and why.", "marks": 100, "days": 14}, "c4": {"title": "Capstone: Build a Simple Utility App", "desc": "Build a small Android app (e.g. a BMI calculator, a unit converter, or a simple to-do list) using Kotlin and ConstraintLayout. It must have at least one Activity, take user input, and show a result using a Toast or TextView. Submit the project source or an APK.", "marks": 100, "days": 14}, "c5": {"title": "Capstone: 2-Week Digital Marketing Plan", "desc": "Pick a small business idea (real or hypothetical) and write a 2-week digital marketing plan: target audience, 1 SEO keyword strategy, a content calendar (at least 6 posts) for one social platform, and 3 metrics you would track to measure success.", "marks": 100, "days": 14}, "c6": {"title": "Capstone: Student Record Mini-System", "desc": "Write a C program that stores marks for up to 10 students in arrays, calculates each student's average using a function, and finds the topper using pointers. The program should take input via scanf and display a clean formatted report using printf.", "marks": 100, "days": 14}};
  const TOPIC_ASSIGNMENTS = {"Introduction to HTML": {"title": "HTML Structure Practice", "desc": "Create a single HTML page for a 'Recipe' with a heading, an image, an ingredients list (ul), numbered steps (ol), and a link back to your favourite recipe website. Use at least 2 semantic tags.", "marks": 20, "days": 5}, "Styling with CSS": {"title": "Style the Recipe Page", "desc": "Take your HTML recipe page from the previous assignment and style it with CSS: a readable font pairing, a consistent color palette, proper spacing using the box model, and a Flexbox layout for the ingredients section.", "marks": 20, "days": 5}, "JavaScript Basics": {"title": "Simple Calculator Logic", "desc": "Write a JavaScript function `calculate(a, b, operator)` that takes two numbers and an operator ('+','-','*','/') and returns the result. Test it with at least 4 different inputs using console.log.", "marks": 20, "days": 5}, "DOM Manipulation": {"title": "Interactive To-Do List", "desc": "Build a basic to-do list: an input box, an 'Add' button, and a list. Clicking Add should insert a new list item, and clicking an item should toggle a 'done' style (strikethrough). Use querySelector and addEventListener only.", "marks": 25, "days": 7}, "Building a Project": {"title": "Mini Landing Page", "desc": "Combine HTML, CSS and JS to build a one-page product landing page (any fictional product) with a hero section, a features section, and a working 'Subscribe' button that shows a thank-you message without reloading the page.", "marks": 25, "days": 7}, "Python Syntax Refresher": {"title": "Grade Calculator Script", "desc": "Write a Python script that takes 5 subject marks as input, calculates the average, and prints a grade (A/B/C/D/F) using if-elif-else. Use a function, not inline code.", "marks": 20, "days": 5}, "NumPy Arrays": {"title": "Array Statistics Practice", "desc": "Create a NumPy array of 20 random integers between 1-100 (np.random.randint). Compute and print its mean, max, min, and the count of numbers greater than 50 using vectorized operations (no manual loops).", "marks": 20, "days": 5}, "Pandas DataFrames": {"title": "CSV Exploration Task", "desc": "Load any small CSV (student marks, sales data, etc.) into a DataFrame. Print df.head(), df.describe(), filter rows where one numeric column exceeds its mean, and save the filtered result to a new CSV.", "marks": 25, "days": 7}, "Data Visualization": {"title": "Three-Chart Report", "desc": "Using any dataset from the Pandas assignment, create 3 different chart types (e.g. bar, line, histogram) with Matplotlib, each with a title and axis labels. Save all charts as image files.", "marks": 20, "days": 5}, "Mini Project": {"title": "End-to-End Mini Analysis", "desc": "Pick a dataset, define one clear question, clean the data, analyze it with Pandas, visualize the answer with one clear chart, and write a 100-word summary of your finding.", "marks": 25, "days": 7}, "Design Principles": {"title": "Spot the Principles", "desc": "Take screenshots of 3 apps/websites you use. For each, identify and label (in a short doc or image annotation) at least 2 design principles being used (balance, contrast, hierarchy, alignment, proximity).", "marks": 20, "days": 5}, "Color Theory": {"title": "Build a Color Palette", "desc": "Create a complete UI color palette (primary, 1-2 accent colors, neutrals, and success/error colors) for a fictional app of your choice. Show the hex codes and explain your color choice in 2-3 sentences.", "marks": 20, "days": 5}, "Typography": {"title": "Typography Comparison", "desc": "Pick 2 font pairings (1 heading + 1 body font each) and create a simple mockup (even in Figma or Canva) showing the same sample text in both pairings. Write which one you'd choose for a banking app vs a kids' app, and why.", "marks": 20, "days": 5}, "Wireframing": {"title": "Low-Fi to Hi-Fi Wireframe", "desc": "Choose a simple app idea (e.g. a grocery list app). Sketch a low-fidelity wireframe of its main screen, then create a high-fidelity version with real colors, fonts and content in Figma.", "marks": 25, "days": 7}, "Setting up Android Studio": {"title": "Hello World Setup", "desc": "Install Android Studio, create a new 'Empty Activity' project, run it on an emulator, and change the default TextView to show your own name and college. Submit a screenshot of it running.", "marks": 15, "days": 5}, "Kotlin Basics": {"title": "Kotlin Practice Functions", "desc": "Write 3 Kotlin functions: one to check if a number is prime, one to reverse a string, and one data class representing a Student (name, rollNo, marks). Test all three in a main() function.", "marks": 20, "days": 5}, "Activities & Layouts": {"title": "Profile Screen Layout", "desc": "Design a simple 'Profile' screen XML layout using ConstraintLayout with an ImageView, a Name TextView, a Bio TextView, and an 'Edit' button — all properly constrained and aligned.", "marks": 20, "days": 5}, "Building Your First App": {"title": "BMI Calculator App", "desc": "Build a working BMI calculator app: two EditText fields (height, weight), a Calculate button, and a TextView showing the result and category (Underweight/Normal/Overweight) when clicked.", "marks": 25, "days": 7}, "Intro to Digital Marketing": {"title": "Funnel Mapping Exercise", "desc": "Pick any brand you follow on social media. Map out one piece of their content for each funnel stage (Awareness, Interest, Consideration, Conversion) — screenshot or describe each.", "marks": 20, "days": 5}, "SEO Basics": {"title": "Keyword Research Task", "desc": "Pick a topic/niche (e.g. 'home workout'). Find 5 related keywords using any free keyword tool, note their approximate search intent, and write one SEO-friendly blog title and meta description for the best keyword.", "marks": 20, "days": 5}, "Social Media Strategy": {"title": "1-Week Content Calendar", "desc": "Create a 7-day content calendar for an Instagram page of your choice (real or fictional brand), with a mix of content types (educational, behind-the-scenes, promotional) and a caption idea for each day.", "marks": 25, "days": 7}, "Variables & Data Types": {"title": "Basic I/O Program", "desc": "Write a C program that takes a student's name, roll number, and 3 subject marks as input, calculates the total and average, and prints a neatly formatted report card using printf.", "marks": 20, "days": 5}, "Loops & Conditions": {"title": "Pattern & Prime Checker", "desc": "Write two C programs: one that prints a right-angled triangle pattern of stars using nested loops (size taken as input), and one that checks whether a given number is prime.", "marks": 20, "days": 5}, "Functions": {"title": "Modular Calculator", "desc": "Write a C program with separate functions for addition, subtraction, multiplication, and division. Use a menu (switch-case) to let the user pick an operation, then call the correct function.", "marks": 20, "days": 5}, "Arrays & Pointers": {"title": "Array Operations with Pointers", "desc": "Write a C program that stores 10 numbers in an array, then uses a pointer (not array indexing) to find the sum, maximum, and reverse the array in place.", "marks": 25, "days": 7}};
  const allCourses = [c1,c2,c3,c4,c5,c6];
  const courseVarIds = {c1:c1.id,c2:c2.id,c3:c3.id,c4:c4.id,c5:c5.id,c6:c6.id};
  Object.keys(COURSE_ASSIGNMENTS).forEach(cv=>{
    const ca = COURSE_ASSIGNMENTS[cv];
    db.assignments.push({id:uid('asg'), courseId:courseVarIds[cv], title:ca.title, description:ca.desc,
      dueDate:new Date(now + ca.days*86400000).toISOString().slice(0,10), maxMarks:ca.marks, createdAt:now});
  });
  allCourses.forEach(c=>{
    c.lessons.forEach(l=>{
      const ta = TOPIC_ASSIGNMENTS[l.title];
      if(ta){ db.assignments.push({id:uid('asg'), courseId:c.id, title:ta.title, description:ta.desc,
        dueDate:new Date(now + ta.days*86400000).toISOString().slice(0,10), maxMarks:ta.marks, createdAt:now}); }
    });
  });

  return db;
}

applyTheme();

/* ===================== HELPERS ===================== */
let session = null; // {role, id}
function toast(msg, icon){
  const el = document.createElement('div'); el.className='toast';
  el.innerHTML = `<span>${icon||'🔔'}</span><span>${msg}</span>`;
  document.getElementById('toast-stack').appendChild(el);
  setTimeout(()=>el.remove(), 4200);
}
function getUser(id){ return DB.users.find(u=>u.id===id); }
function getCourse(id){ return DB.courses.find(c=>c.id===id); }
function certIdFor(courseId, userId){ return 'EDU-'+courseId.slice(-5).toUpperCase()+'-'+userId.slice(-4).toUpperCase(); }
function openVerifyModal(){ document.getElementById('vf-id').value=''; document.getElementById('vf-result').innerHTML=''; document.getElementById('verify-modal').classList.add('show'); }
function closeVerifyModal(){ document.getElementById('verify-modal').classList.remove('show'); }
function verifyCertificate(){
  const input = document.getElementById('vf-id').value.trim().toUpperCase();
  const box = document.getElementById('vf-result');
  if(!input){ box.innerHTML = '<div class="error-msg" style="display:block;">Enter a certificate ID.</div>'; return; }
  const issued = DB.enrollments.filter(e=>e.certificateIssued);
  const hit = issued.find(e=> certIdFor(e.courseId, e.studentId) === input);
  if(!hit){ box.innerHTML = '<div class="error-msg" style="display:block;">❌ No certificate found with this ID.</div>'; return; }
  const u = getUser(hit.studentId), c = getCourse(hit.courseId);
  box.innerHTML = `<div class="ok-msg" style="display:block;">✅ Valid Certificate<br>
    <b>${u?u.name:'—'}</b> completed <b>${c?c.title:'—'}</b><br>
    Score: ${hit.quizScore}% &nbsp;|&nbsp; Issued: ${fmtDate(hit.certIssuedAt||hit.enrolledAt)}</div>`;
}
/* ---- Gamification: points, streak, badges ---- */
const BADGES = {
  first_steps:{label:'First Steps',icon:'🌱'}, century:{label:'Century Scorer',icon:'💯'},
  streak3:{label:'3-Day Streak',icon:'🔥'}, streak7:{label:'7-Day Streak',icon:'🔥🔥'},
  first_cert:{label:'First Certificate',icon:'🎓'}, cert_master:{label:'Certificate Master',icon:'👑'}
};
function ensureGam(u){
  if(!u) return u;
  if(u.points===undefined) u.points=0;
  if(u.streak===undefined) u.streak=0;
  if(u.lastActiveDate===undefined) u.lastActiveDate=null;
  if(u.badges===undefined) u.badges=[];
  return u;
}
function awardPoints(studentId, amount){
  const u = getUser(studentId); if(!u) return; ensureGam(u);
  u.points += amount;
  const today = new Date().toDateString();
  if(u.lastActiveDate !== today){
    const yesterday = new Date(Date.now()-86400000).toDateString();
    u.streak = (u.lastActiveDate===yesterday) ? u.streak+1 : 1;
    u.lastActiveDate = today;
  }
  checkBadges(u);
}
function checkBadges(u){
  const earn=(key)=>{ if(!u.badges.includes(key)){ u.badges.push(key); toast('Badge earned: '+BADGES[key].label, BADGES[key].icon); } };
  if(u.points>=10) earn('first_steps');
  if(u.points>=100) earn('century');
  if(u.streak>=3) earn('streak3');
  if(u.streak>=7) earn('streak7');
  const certs = DB.enrollments.filter(e=>e.studentId===u.id && e.certificateIssued).length;
  if(certs>=1) earn('first_cert');
  if(certs>=3) earn('cert_master');
}
/* ---- Wishlist ---- */
function isWishlisted(courseId){ return !!(session && DB.wishlist.find(w=>w.studentId===session.id && w.courseId===courseId)); }
function toggleWishlist(courseId, ev){
  if(ev) ev.stopPropagation();
  if(!session){ openAuth('login'); toast('Please login to save courses.','🔒'); return; }
  const idx = DB.wishlist.findIndex(w=>w.studentId===session.id && w.courseId===courseId);
  if(idx>-1){ DB.wishlist.splice(idx,1); toast('Removed from wishlist.','💔'); }
  else { DB.wishlist.push({studentId:session.id, courseId}); toast('Saved to wishlist!','❤️'); }
  saveDB();
  if(document.getElementById('view-s-browse').classList.contains('active')) renderStudentBrowse();
  if(document.getElementById('view-s-wishlist')?.classList.contains('active')) renderWishlist();
}
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function scrollToId(id){ document.getElementById(id).scrollIntoView({behavior:'smooth'}); }
function goHome(){ document.getElementById('app-screen').classList.remove('show'); document.getElementById('public-screen').style.display='block'; renderPublicSite(); }

/* ===================== PUBLIC SITE RENDER ===================== */
function renderPublicSite(){
  document.getElementById('cat-grid').innerHTML = DB.categories.map(c=>`
    <div class="cat-card" onclick="filterHomeCat('${c}')"><span class="ic">${catIcon(c)}</span>${c}</div>`).join('');
  renderCatalog('courses-section-grid');
  const students = DB.users.filter(u=>u.role==='student').length;
  const instructors = DB.users.filter(u=>u.role==='instructor' && u.status==='approved').length;
  const courses = DB.courses.filter(c=>c.status==='approved').length;
  const completions = DB.enrollments.filter(e=>e.certificateIssued).length;
  document.getElementById('home-stats').innerHTML = `
    <div><div class="n">${students}+</div><div class="l">Students</div></div>
    <div><div class="n">${instructors}+</div><div class="l">Instructors</div></div>
    <div><div class="n">${courses}+</div><div class="l">Courses</div></div>
    <div><div class="n">${completions}+</div><div class="l">Completions</div></div>`;
}
function catIcon(c){
  const map={'Web Development':'💻','Data Science':'📊','Mobile Development':'📱','Design':'🎨','Business':'📈','Programming Basics':'🖥️'};
  return map[c]||'📘';
}
function filterHomeCat(cat){ document.getElementById('home-search').value=''; scrollToId('courses-section'); renderCatalog('courses-section-grid', cat); }
function renderCatalog(gridId, forcedCat){
  const q = (document.getElementById('home-search')?.value||'').toLowerCase();
  let list = DB.courses.filter(c=>c.status==='approved');
  if(forcedCat) list = list.filter(c=>c.category===forcedCat);
  if(q) list = list.filter(c=>c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  document.getElementById(gridId).innerHTML = list.map(c=>courseCardHtml(c)).join('') || '<div class="empty-state">No courses found.</div>';
}
function courseCardHtml(c){
  const saved = isWishlisted(c.id);
  return `<div class="course-card" onclick="handleCourseClick('${c.id}')">
    <div class="course-thumb">${c.thumb}<span onclick="toggleWishlist('${c.id}',event)" style="position:absolute;top:8px;right:8px;font-size:18px;cursor:pointer;">${saved?'❤️':'🤍'}</span></div>
    <div class="course-body">
      <h4>${c.title}</h4>
      <div class="course-meta"><span>👤 ${c.instructorName}</span><span>⏱️ ${c.duration}</span></div>
      <div class="course-meta"><span class="badge gray">${c.category}</span><span class="badge green">Free</span></div>
      <div class="course-foot"><span style="font-size:11.5px;color:var(--muted);">${c.lessons.length} lessons</span>
      <button class="btn btn-primary btn-sm">Enroll</button></div>
    </div></div>`;
}
function handleCourseClick(courseId){
  if(!session){ openAuth('login'); toast('Please login to view and enroll in this course.','🔒'); return; }
  if(session.role!=='student'){ toast('Only students can enroll in courses.','ℹ️'); return; }
  enrollAndOpen(courseId);
}
function enrollAndOpen(courseId){
  let enr = DB.enrollments.find(e=>e.studentId===session.id && e.courseId===courseId);
  if(!enr){
    enr = {id:uid('enr'), studentId:session.id, courseId, enrolledAt:Date.now(), completedLessons:[], lastLesson:null, quizScore:null, certificateIssued:false};
    DB.enrollments.push(enr); saveDB();
    toast('Enrolled successfully!','✅');
    const c = getCourse(courseId); const u = getUser(session.id);
    sendEmail(u.email, `You're enrolled in ${c.title}!`, emailShell('Enrollment Confirmed',
      `<p>Hi ${u.name},</p><p>You've successfully enrolled in <b>${c.title}</b>. Head back to EduSphere anytime to start learning.</p>`));
  }
  openPlayer(courseId);
}


/* ===================== AUTH ===================== */
let loginRole='student', regRole='student';
function openAuth(tab){ document.getElementById('auth-modal').classList.add('show'); switchAuthTab(tab); }
function closeAuth(){ document.getElementById('auth-modal').classList.remove('show'); hideAuthMsgs(); }
function openForgot(ev){ ev.preventDefault(); switchAuthTab('forgot'); }
function switchAuthTab(t){
  hideAuthMsgs();
  ['login','register','forgot'].forEach(x=>document.getElementById('form-'+x).classList.toggle('hidden', x!==t));
  if(t==='login'||t==='register'){
    document.getElementById('tab-login').classList.toggle('active', t==='login');
    document.getElementById('tab-register').classList.toggle('active', t==='register');
  }
}
function hideAuthMsgs(){ document.getElementById('auth-error').style.display='none'; document.getElementById('auth-ok').style.display='none'; }
function showAuthErr(m){ const e=document.getElementById('auth-error'); e.textContent=m; e.style.display='block'; }
function showAuthOk(m){ const e=document.getElementById('auth-ok'); e.textContent=m; e.style.display='block'; }
function setLoginRole(r){ loginRole=r; document.querySelectorAll('.role-btn').forEach(b=>b.classList.toggle('active', b.dataset.role===r)); }
function setRegRole(r){ regRole=r; document.querySelectorAll('.reg-role-btn').forEach(b=>b.classList.toggle('active', b.dataset.role===r));
  document.getElementById('reg-note').classList.toggle('hidden', r!=='instructor'); }

function handleLogin(ev){
  ev.preventDefault(); hideAuthMsgs();
  const email=document.getElementById('li-email').value.trim().toLowerCase();
  const pass=document.getElementById('li-pass').value;
  const user = DB.users.find(u=>u.email.toLowerCase()===email && u.role===loginRole);
  if(!user){ showAuthErr('No '+loginRole+' account found with this email.'); return false; }
  if(user.pass!==pass){ showAuthErr('Incorrect password.'); return false; }
  if(user.role==='instructor' && user.status!=='approved'){ showAuthErr('Your instructor account is pending admin approval.'); return false; }
  session={role:user.role, id:user.id};
  closeAuth(); enterApp();
  return false;
}
function handleRegister(ev){
  ev.preventDefault(); hideAuthMsgs();
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim().toLowerCase();
  const pass=document.getElementById('r-pass').value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showAuthErr('Enter a valid email address.'); return false; }
  if(pass.length<6){ showAuthErr('Password must be at least 6 characters.'); return false; }
  if(DB.users.some(u=>u.email.toLowerCase()===email)){ showAuthErr('An account with this email already exists.'); return false; }
  const newUser = {id:uid('u'), role:regRole, name, email, pass};
  if(regRole==='instructor') newUser.status='pending';
  DB.users.push(newUser); saveDB();
  if(regRole==='instructor'){
    showAuthOk('Registered! Your instructor account is pending admin approval.');
  }else{
    showAuthOk('Account created successfully! You can log in now.');
  }
  document.getElementById('form-register').reset();
  setTimeout(()=>{ switchAuthTab('login'); document.getElementById('li-email').value=email; setLoginRole(regRole); }, 900);
  return false;
}
function handleForgot(ev){
  ev.preventDefault();
  const email=document.getElementById('fg-email').value.trim().toLowerCase();
  const user = DB.users.find(u=>u.email.toLowerCase()===email);
  if(!user){ showAuthErr('No account found with this email.'); return false; }
  user.pass='reset1234'; saveDB();
  showAuthOk('Password reset! Your new password is: reset1234');
  return false;
}
function logout(){ session=null; document.getElementById('app-screen').classList.remove('show'); goHome();
  document.getElementById('ai-fab').style.display='none'; document.getElementById('ai-chat-panel').style.display='none'; }

/* ===================== APP ENTRY / ROUTING ===================== */
const titles = {
  's-dashboard':['Dashboard','Your learning overview'],'s-progress':['Progress','Charts of your completion and quiz performance'],'s-browse':['Browse Courses','Find your next course'],
  's-mycourses':['My Courses','Courses you are enrolled in'],'course-player':['Course','Lecture & notes'],
  's-wishlist':['Wishlist','Courses you have saved'],
  's-assignments':['Assignments','Your pending and submitted work'],
  's-certificates':['My Certificates','Courses you have completed'],'cert-detail':['Certificate',''],
  's-notifications':['Notifications',''],'s-profile':['Profile','Manage your account'],
  'i-dashboard':['Dashboard','Your teaching overview'],'i-courses':['My Courses','Create and manage courses'],
  'i-assignments':['Assignments','Create assignments and view submissions'],
  'i-students':['Enrolled Students','Track student progress'],'i-profile':['Profile','Manage your account'],
  'a-dashboard':['Admin Overview','Platform-wide statistics'],'a-students':['Manage Students',''],
  'a-instructors':['Manage Instructors',''],'a-courses':['Manage Courses',''],'a-categories':['Manage Categories',''],
  'a-feedback':['User Feedback',''],'a-settings':['Website Settings',''],
};
function enterApp(){
  document.getElementById('public-screen').style.display='none';
  document.getElementById('app-screen').classList.add('show');
  document.getElementById('nav-student').classList.toggle('hidden', session.role!=='student');
  document.getElementById('nav-instructor').classList.toggle('hidden', session.role!=='instructor');
  document.getElementById('nav-admin').classList.toggle('hidden', session.role!=='admin');
  const u = getUser(session.id);
  if(session.role==='student') showView('s-dashboard');
  if(session.role==='instructor') showView('i-dashboard');
  if(session.role==='admin') showView('a-dashboard');
  toast('Welcome, '+(u?u.name.split(' ')[0]:'Admin')+'!','👋');
  document.getElementById('ai-fab').style.display='flex';
}
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el = document.getElementById('view-'+name); if(el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.view===name));
  if(titles[name]){ document.getElementById('page-title').textContent=titles[name][0]; document.getElementById('page-sub').textContent=titles[name][1]; }
  toggleSidebar(false);
  const map = {
    's-dashboard':renderStudentDashboard,'s-progress':renderStudentProgress,'s-browse':renderStudentBrowse,'s-mycourses':renderMyCourses,
    's-wishlist':renderWishlist,
    's-assignments':renderStudentAssignments,
    's-certificates':renderCertificates,'s-notifications':renderNotifications,'s-profile':renderStudentProfile,
    'i-dashboard':renderInstructorDashboard,'i-courses':renderInstructorCourses,'i-students':renderInstructorStudents,'i-profile':renderInstructorProfile,
    'i-assignments':renderInstructorAssignments,
    'a-dashboard':renderAdminDashboard,'a-students':renderAdminStudents,'a-instructors':renderAdminInstructors,
    'a-courses':renderAdminCourses,'a-categories':renderAdminCategories,'a-feedback':renderAdminFeedback,'a-settings':renderAdminSettings,
  };
  if(map[name]) map[name]();
}
function toggleSidebar(open){ document.getElementById('sidebar').classList.toggle('open', !!open); document.getElementById('overlay').classList.toggle('show', !!open); }

/* ===================== STUDENT ===================== */
function myEnrollments(){ return DB.enrollments.filter(e=>e.studentId===session.id); }
function renderStudentDashboard(){
  const enrs = myEnrollments();
  const completed = enrs.filter(e=>e.certificateIssued).length;
  const avgProg = enrs.length ? Math.round(enrs.reduce((s,e)=>s+courseProgress(e),0)/enrs.length) : 0;
  document.getElementById('s-stat-cards').innerHTML = `
    <div class="card stat-card"><div class="k">Enrolled Courses</div><div class="v">${enrs.length}</div></div>
    <div class="card stat-card"><div class="k">Completed</div><div class="v">${completed}</div></div>
    <div class="card stat-card"><div class="k">Avg. Progress</div><div class="v">${avgProg}%</div></div>
    <div class="card stat-card"><div class="k">Certificates</div><div class="v">${completed}</div></div>`;

  const cont = enrs.filter(e=>courseProgress(e)<100).sort((a,b)=>b.enrolledAt-a.enrolledAt)[0];
  document.getElementById('s-continue').innerHTML = cont ? (()=>{
    const c=getCourse(cont.courseId); const pct=courseProgress(cont);
    return `<div class="row-between"><div><b>${c.title}</b><div style="font-size:11.5px;color:var(--muted);">${pct}% complete</div></div>
      <button class="btn btn-primary btn-sm" onclick="openPlayer('${c.id}')">Continue</button></div>
      <div class="progress-bar" style="margin-top:10px;"><div class="fill" style="width:${pct}%"></div></div>`;
  })() : '<div class="empty-state">No courses in progress. Browse courses to get started!</div>';

  document.getElementById('s-dash-courses').innerHTML = enrs.map(e=>{
    const c=getCourse(e.courseId); const pct=courseProgress(e);
    return `<div class="course-card"><div class="course-thumb">${c.thumb}</div><div class="course-body">
      <h4>${c.title}</h4><div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="course-foot"><span style="font-size:11.5px;color:var(--muted);">${pct}% done</span>
      <button class="btn btn-outline btn-sm" onclick="openPlayer('${c.id}')">Open</button></div></div></div>`;
  }).join('') || '<div class="empty-state">Nothing here yet — browse courses to enroll.</div>';
}
function courseProgress(enr){
  const c = getCourse(enr.courseId); if(!c || !c.lessons.length) return 0;
  return Math.round((enr.completedLessons.length / c.lessons.length) * 100);
}
let spDoughnutChart=null, spProgressChart=null, spQuizChart=null;
function chartColors(){
  const dark = document.documentElement.getAttribute('data-theme')==='dark';
  return { grid: dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.06)', text: dark?'#cbd5e1':'#475569' };
}
function renderStudentProgress(){
  const enrs = myEnrollments();
  const cc = chartColors();
  let totalLessons=0, doneLessons=0;
  const labels=[], progressData=[], quizLabels=[], quizData=[], quizColors=[];
  enrs.forEach(e=>{
    const c = getCourse(e.courseId); if(!c) return;
    totalLessons += c.lessons.length; doneLessons += e.completedLessons.length;
    labels.push(c.title.length>18?c.title.slice(0,18)+'…':c.title);
    progressData.push(courseProgress(e));
    if(e.quizScore!==null && e.quizScore!==undefined){
      quizLabels.push(c.title.length>18?c.title.slice(0,18)+'…':c.title);
      quizData.push(e.quizScore);
      quizColors.push(e.quizScore>=70?'#22c55e':e.quizScore>=40?'#f59e0b':'#ef4444');
    }
  });
  const remaining = Math.max(totalLessons-doneLessons,0);
  const overallPct = totalLessons ? Math.round(doneLessons/totalLessons*100) : 0;

  document.getElementById('sp-stat-cards').innerHTML = `
    <div class="card stat-card"><div class="k">Overall Completion</div><div class="v">${overallPct}%</div></div>
    <div class="card stat-card"><div class="k">Lessons Done</div><div class="v">${doneLessons}/${totalLessons}</div></div>
    <div class="card stat-card"><div class="k">Courses in Progress</div><div class="v">${enrs.length}</div></div>`;

  if(spDoughnutChart) spDoughnutChart.destroy();
  spDoughnutChart = new Chart(document.getElementById('sp-doughnut'), {
    type:'doughnut',
    data:{ labels:['Completed','Remaining'], datasets:[{ data:[doneLessons, remaining], backgroundColor:['#5b3df0','#e2e2f0'] }] },
    options:{ plugins:{ legend:{ position:'bottom', labels:{ color: cc.text } } } }
  });

  document.getElementById('sp-progress-empty').classList.toggle('hidden', labels.length>0);
  if(spProgressChart) spProgressChart.destroy();
  if(labels.length){
    spProgressChart = new Chart(document.getElementById('sp-progress-bar'), {
      type:'bar',
      data:{ labels, datasets:[{ label:'% Complete', data:progressData, backgroundColor:'#5b3df0', borderRadius:6 }] },
      options:{ maintainAspectRatio:false, scales:{ y:{ min:0, max:100, ticks:{ color:cc.text }, grid:{ color:cc.grid } }, x:{ ticks:{ color:cc.text }, grid:{ display:false } } }, plugins:{ legend:{ display:false } } }
    });
  }

  document.getElementById('sp-quiz-empty').classList.toggle('hidden', quizLabels.length>0);
  if(spQuizChart) spQuizChart.destroy();
  if(quizLabels.length){
    spQuizChart = new Chart(document.getElementById('sp-quiz-bar'), {
      type:'bar',
      data:{ labels:quizLabels, datasets:[{ label:'Quiz Score %', data:quizData, backgroundColor:quizColors, borderRadius:6 }] },
      options:{ maintainAspectRatio:false, scales:{ y:{ min:0, max:100, ticks:{ color:cc.text }, grid:{ color:cc.grid } }, x:{ ticks:{ color:cc.text }, grid:{ display:false } } }, plugins:{ legend:{ display:false } } }
    });
    let best=0, worst=0;
    quizData.forEach((v,i)=>{ if(v>quizData[best]) best=i; if(v<quizData[worst]) worst=i; });
    document.getElementById('sp-strong-weak').innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <span class="badge green">💪 Strongest: ${quizLabels[best]} (${quizData[best]}%)</span>
        <span class="badge amber">📚 Needs practice: ${quizLabels[worst]} (${quizData[worst]}%)</span>
      </div>`;
  } else {
    document.getElementById('sp-strong-weak').innerHTML='';
  }
}
function renderStudentBrowse(){
  const catSel = document.getElementById('sb-cat');
  if(catSel.options.length<=1) catSel.innerHTML = '<option value="all">All Categories</option>' + DB.categories.map(c=>`<option>${c}</option>`).join('');
  const q=(document.getElementById('sb-search').value||'').toLowerCase();
  const cat=document.getElementById('sb-cat').value;
  let list = DB.courses.filter(c=>c.status==='approved');
  if(cat!=='all') list=list.filter(c=>c.category===cat);
  if(q) list=list.filter(c=>c.title.toLowerCase().includes(q));
  document.getElementById('sb-grid').innerHTML = list.map(c=>courseCardHtml(c)).join('') || '<div class="empty-state">No courses found.</div>';
}
function renderMyCourses(){
  const enrs = myEnrollments();
  document.getElementById('s-my-grid').innerHTML = enrs.map(e=>{
    const c=getCourse(e.courseId); const pct=courseProgress(e);
    return `<div class="course-card"><div class="course-thumb">${c.thumb}</div><div class="course-body">
      <h4>${c.title}</h4><div class="course-meta"><span>👤 ${c.instructorName}</span></div>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="course-foot"><span style="font-size:11.5px;color:var(--muted);">${pct}% complete</span>
      <button class="btn btn-primary btn-sm" onclick="openPlayer('${c.id}')">Continue</button></div></div></div>`;
  }).join('');
  document.getElementById('s-my-empty').classList.toggle('hidden', enrs.length>0);
}

/* ---- Course Player ---- */
let currentCourseId=null, currentLessonId=null;
function openPlayer(courseId){
  currentCourseId=courseId;
  const c=getCourse(courseId);
  const enr = DB.enrollments.find(e=>e.studentId===session.id && e.courseId===courseId);
  currentLessonId = enr.lastLesson || (c.lessons[0] && c.lessons[0].id);
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-course-player').classList.add('active');
  document.getElementById('page-title').textContent=c.title;
  document.getElementById('page-sub').textContent='by '+c.instructorName;
  setPlayerTab('video');
  renderPlayer();
}
function renderPlayer(){
  const c=getCourse(currentCourseId);
  const enr = DB.enrollments.find(e=>e.studentId===session.id && e.courseId===currentCourseId);
  const pct = courseProgress(enr);
  document.getElementById('cp-title').textContent=c.title;
  document.getElementById('cp-progress-txt').textContent=pct+'% complete';
  document.getElementById('cp-progress-fill').style.width=pct+'%';
  document.getElementById('cp-yt-banner').innerHTML = c.youtubeUrl ? `<a href="${c.youtubeUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="margin-bottom:12px;display:inline-flex;align-items:center;gap:6px;">▶️ Watch Real Lectures on YouTube ↗</a>` : '';

  document.getElementById('cp-lesson-list').innerHTML = c.lessons.map(l=>{
    const done = enr.completedLessons.includes(l.id);
    return `<div class="lesson-list-item ${done?'done':''} ${l.id===currentLessonId?'active':''}" onclick="selectLesson('${l.id}')">
      <span class="chk">${done?'✓':''}</span><span>${l.type==='video'?'🎥':'📄'} ${l.title}</span></div>`;
  }).join('');

  const lesson = c.lessons.find(l=>l.id===currentLessonId) || c.lessons[0];
  if(lesson){
    document.getElementById('cp-lesson-desc').innerHTML = (lesson.content.match(/<p class="ov"[^>]*>.*?<\/p>/)||[lesson.content])[0];
    loadLessonVideo(lesson, c);
    document.getElementById('cp-notes-content').innerHTML = `<h4 style="margin-bottom:8px;color:var(--text);">${lesson.title}</h4><div>${lesson.content}</div>`;
    const done = enr.completedLessons.includes(lesson.id);
    const btn = document.getElementById('cp-complete-btn');
    btn.textContent = done ? '✓ Completed — tap to undo' : 'Mark Lesson as Completed';
    btn.disabled = false;
    btn.style.opacity = 1;
  }
  renderQuizArea(enr, c);
}
function loadLessonVideo(lesson, c){
  const ph = document.getElementById('cp-video-placeholder');
  const link = lesson.videoLink || c.youtubeUrl;
  if(lesson.type==='video' && link){
    ph.innerHTML = `<a href="${link}" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;gap:10px;text-decoration:none;color:#fff;">
      <span style="width:64px;height:64px;border-radius:50%;background:#ff0000;display:flex;align-items:center;justify-content:center;font-size:26px;">▶</span>
      <span style="font-weight:700;">${lesson.title}</span>
      <span style="font-size:12px;color:rgba(255,255,255,.7);">Tap to watch on YouTube ↗</span>
    </a>`;
  } else if(lesson.type==='video'){
    ph.innerHTML = `<span class="play-ic">🎥</span><span style="font-weight:700;">${lesson.title}</span><span style="font-size:12px;color:rgba(255,255,255,.6);">Video coming soon for this course</span>`;
  } else {
    ph.innerHTML = `<span class="play-ic">📄</span><span style="font-weight:700;">${lesson.title}</span><span style="font-size:12px;color:rgba(255,255,255,.6);">This lesson is text-based — see the Notes tab</span>`;
  }
  const pdfBtn = document.getElementById('cp-pdf-btn');
  if(pdfBtn){
    if(lesson.pdfData){ pdfBtn.style.display='inline-flex'; pdfBtn.onclick = ()=>{ const w=window.open(); w.document.write('<iframe src="'+lesson.pdfData+'" style="width:100%;height:100vh;border:0;"></iframe>'); }; }
    else pdfBtn.style.display='none';
  }
}
document.addEventListener('ended', function(e){
  if(e.target && e.target.id==='cp-video-el') toast('Lecture finished — mark it completed!','🎬');
}, true);
function selectLesson(lessonId){
  currentLessonId=lessonId;
  const enr = DB.enrollments.find(e=>e.studentId===session.id && e.courseId===currentCourseId);
  enr.lastLesson=lessonId; saveDB();
  renderPlayer();
}
function setPlayerTab(tab){
  ['video','notes','quiz'].forEach(t=>{
    document.getElementById('cp-tab-'+t).classList.toggle('active', t===tab);
    document.getElementById('cp-pane-'+t).classList.toggle('hidden', t!==tab);
  });
}
function markLessonComplete(){
  const enr = DB.enrollments.find(e=>e.studentId===session.id && e.courseId===currentCourseId);
  const idx = enr.completedLessons.indexOf(currentLessonId);
  if(idx===-1){
    enr.completedLessons.push(currentLessonId);
    awardPoints(session.id, 10);
    toast('Lesson marked as completed! +10 pts','✅');
  } else {
    enr.completedLessons.splice(idx,1);
    toast('Lesson marked as not completed','↩️');
  }
  saveDB();
  renderPlayer();
}
let currentQuizSet=null, currentQuizForCourse=null, lastQuizReview=null;
function shuffleArr(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function pickRandomQuestions(c, n){
  const pool = shuffleArr(c.quiz);
  const picked = pool.slice(0, Math.min(n, pool.length));
  return picked.map(q=>{
    const opts = shuffleArr(q.options.map((o,idx)=>({o,idx})));
    const newAnswer = opts.findIndex(x=>x.idx===q.answer);
    return {id:q.id, q:q.q, options:opts.map(x=>x.o), answer:newAnswer};
  });
}
function renderQuizArea(enr, c){
  const allDone = enr.completedLessons.length >= c.lessons.length;
  const area = document.getElementById('cp-quiz-area');
  if(!allDone){ area.innerHTML = '<div class="empty-state">Complete all lessons to unlock the quiz.</div>'; return; }
  if(enr.quizScore!==null && enr.quizScore!==undefined){
    let reviewHtml = '';
    if(lastQuizReview && lastQuizReview.courseId===c.id){
      reviewHtml = `<div style="text-align:left;margin-top:18px;">${lastQuizReview.set.map((q,i)=>{
        const picked = lastQuizReview.answers[i];
        return `<div class="quiz-q"><b>${i+1}. ${q.q}</b>
          ${q.options.map((o,oi)=>{
            let cls='quiz-opt';
            if(oi===q.answer) cls+=' correct';
            else if(oi===picked) cls+=' wrong';
            return `<div class="${cls}" style="cursor:default;"><span class="opt-circle"></span><span>${o}</span></div>`;
          }).join('')}</div>`;
      }).join('')}</div>`;
    }
    area.innerHTML = `<div class="panel" style="text-align:center;">
      <h3>Quiz Result</h3><div style="font-size:32px;font-weight:900;color:var(--p);">${enr.quizScore}%</div>
      <p style="color:var(--muted);font-size:13px;margin:8px 0 16px;">${enr.quizScore>=60?'Great job! You passed the quiz.':'Keep practicing — you can retake the quiz.'}</p>
      <p style="color:var(--muted);font-size:11.5px;margin:-8px 0 16px;">Each attempt has 10 random questions from the question bank. Green = correct answer, Red = your wrong pick.</p>
      <button class="btn btn-outline btn-sm" onclick="retakeQuiz()">Retake Quiz</button>
      ${enr.certificateIssued ? `<button class="btn btn-primary btn-sm" onclick="viewCertificate('${c.id}')">View Certificate 🎓</button>` : ''}
      ${reviewHtml}
      </div>`;
    return;
  }
  if(!currentQuizSet || currentQuizForCourse!==c.id){ currentQuizSet = pickRandomQuestions(c,10); currentQuizForCourse=c.id; window._quizAnswers = {}; }
  area.innerHTML = `<div id="quiz-form">${currentQuizSet.map((q,i)=>`
    <div class="quiz-q"><b>${i+1}. ${q.q}</b>
      ${q.options.map((o,oi)=>`<div class="quiz-opt${window._quizAnswers[i]===oi?' selected':''}" data-q="${i}" data-o="${oi}" onclick="selectOpt(${i},${oi})"><span class="opt-circle"></span><span>${o}</span></div>`).join('')}
    </div>`).join('')}
    <button class="btn btn-primary" style="margin-top:10px;" onclick="submitQuiz()">Submit Quiz</button></div>`;
}
function selectOpt(qi,oi){
  window._quizAnswers[qi]=oi;
  document.querySelectorAll(`.quiz-opt[data-q="${qi}"]`).forEach(el=>el.classList.toggle('selected', +el.dataset.o===oi));
}
function submitQuiz(){
  const enr = DB.enrollments.find(e=>e.studentId===session.id && e.courseId===currentCourseId);
  let correct=0;
  (currentQuizSet||[]).forEach((q,i)=>{ if(window._quizAnswers[i]===q.answer) correct++; });
  const total = (currentQuizSet||[]).length || 1;
  const score = Math.round((correct/total)*100);
  enr.quizScore=score;
  const c=getCourse(currentCourseId);
  awardPoints(session.id, score>=60?50:10);
  if(score>=60 && !enr.certificateIssued){
    enr.certificateIssued=true; enr.certIssuedAt=Date.now(); addNotification(session.id, `Certificate earned for "${c.title}"!`);
    const u = getUser(session.id);
    sendEmail(u.email, `🎓 Certificate earned — ${c.title}`, emailShell('Congratulations!',
      `<p>Hi ${u.name},</p><p>You scored <b>${score}%</b> and earned your certificate for <b>${c.title}</b>. Log in to EduSphere to view and download it.</p>`));
  }
  saveDB();
  toast(`Quiz submitted — score: ${score}%`, score>=60?'🎉':'📝');
  lastQuizReview = {courseId: currentCourseId, set: currentQuizSet, answers: {...window._quizAnswers}};
  currentQuizSet=null; currentQuizForCourse=null;
  renderPlayer();
}
function retakeQuiz(){
  const enr = DB.enrollments.find(e=>e.studentId===session.id && e.courseId===currentCourseId);
  enr.quizScore=null; currentQuizSet=null; currentQuizForCourse=null; lastQuizReview=null; saveDB(); renderPlayer();
}
function addNotification(userId, message){ DB.notifications.push({id:uid('ntf'), userId, message, ts:Date.now(), read:false}); }

/* ---- Certificates ---- */
function renderCertificates(){
  const enrs = myEnrollments().filter(e=>e.certificateIssued);
  document.getElementById('s-cert-grid').innerHTML = enrs.map(e=>{
    const c=getCourse(e.courseId);
    return `<div class="course-card"><div class="course-thumb">🎓</div><div class="course-body">
      <h4>${c.title}</h4><div class="course-foot"><span></span><button class="btn btn-primary btn-sm" onclick="viewCertificate('${c.id}')">View</button></div></div></div>`;
  }).join('');
  document.getElementById('s-cert-empty').classList.toggle('hidden', enrs.length>0);
}
function renderWishlist(){
  const items = DB.wishlist.filter(w=>w.studentId===session.id).map(w=>getCourse(w.courseId)).filter(Boolean);
  document.getElementById('s-wishlist-grid').innerHTML = items.map(c=>courseCardHtml(c)).join('');
  document.getElementById('s-wishlist-empty').classList.toggle('hidden', items.length>0);
}
/* ---- Student Assignments ---- */
let submittingAssignmentId=null;
function renderStudentAssignments(){
  const myCourseIds = myEnrollments().map(e=>e.courseId);
  const list = DB.assignments.filter(a=>myCourseIds.includes(a.courseId));
  document.getElementById('sa-list').innerHTML = list.map(a=>{
    const c = getCourse(a.courseId);
    const mySub = DB.submissions.find(s=>s.assignmentId===a.id && s.studentId===session.id);
    return `<div class="panel" style="padding:12px;margin-bottom:10px;">
      <div class="row-between"><b>${a.title}</b><span class="badge gray">${c?c.title:''}</span></div>
      <p style="font-size:12.5px;color:var(--muted);margin:6px 0;">${a.description||''}</p>
      <div style="font-size:11.5px;color:var(--muted);">Due: ${a.dueDate||'—'} · Max Marks: ${a.maxMarks}</div>
      <div class="actions" style="margin-top:10px;justify-content:flex-start;flex-wrap:wrap;gap:8px;">
        ${a.pdfName?`<a href="${a.pdfData}" download="${a.pdfName}" class="btn btn-outline btn-sm">📄 ${a.pdfName}</a>`:''}
        ${mySub ? `<span class="badge green">✓ Submitted on ${new Date(mySub.submittedAt).toLocaleDateString()}</span>`
          : `<button class="btn btn-primary btn-sm" onclick="openSubmitModal('${a.id}')">Submit Assignment</button>`}
      </div></div>`;
  }).join('');
  document.getElementById('sa-empty').classList.toggle('hidden', list.length>0);
  checkAssignmentDeadlineReminders(list);
}
function checkAssignmentDeadlineReminders(list){
  let remindedKey='edusphere_reminded_asg', reminded=[];
  try{ reminded = JSON.parse(localStorage.getItem(remindedKey)||'[]'); }catch(e){}
  const now = Date.now(); const twoDays = 2*86400000;
  const u = getUser(session.id);
  list.forEach(a=>{
    if(!a.dueDate) return;
    const mySub = DB.submissions.find(s=>s.assignmentId===a.id && s.studentId===session.id);
    if(mySub) return;
    const due = new Date(a.dueDate+'T23:59:59').getTime();
    const diff = due - now;
    if(diff>0 && diff<=twoDays && !reminded.includes(a.id)){
      const c = getCourse(a.courseId);
      sendEmail(u.email, `⏰ Due soon: ${a.title}`, emailShell('Assignment Deadline Reminder',
        `<p>Hi ${u.name},</p><p><b>${a.title}</b> (${c?c.title:''}) is due on <b>${a.dueDate}</b> and you haven't submitted it yet. Log in to EduSphere to complete it.</p>`));
      reminded.push(a.id);
    }
  });
  try{ localStorage.setItem(remindedKey, JSON.stringify(reminded)); }catch(e){}
}
function openSubmitModal(assignmentId){
  submittingAssignmentId = assignmentId;
  const a = DB.assignments.find(x=>x.id===assignmentId);
  document.getElementById('sm-title').textContent = 'Submit — ' + a.title;
  document.getElementById('sm-text').value=''; document.getElementById('sm-file').value='';
  document.getElementById('sm-error').style.display='none';
  document.getElementById('submit-modal').classList.add('show');
}
function closeSubmitModal(){ document.getElementById('submit-modal').classList.remove('show'); }
function submitAssignment(){
  const text = document.getElementById('sm-text').value.trim();
  const fileInput = document.getElementById('sm-file');
  const err = document.getElementById('sm-error');
  if(!text && !fileInput.files[0]){ err.textContent='Add some text or attach a file before submitting.'; err.style.display='block'; return; }
  const finish = (fileName, fileData) => {
    DB.submissions.push({ id: uid('sub'), assignmentId: submittingAssignmentId, studentId: session.id, text, fileName: fileName||'', fileData: fileData||'', submittedAt: Date.now() });
    awardPoints(session.id, 20);
    saveDB(); closeSubmitModal(); renderStudentAssignments();
    toast('Assignment submitted! +20 pts','✅');
  };
  const file = fileInput.files[0];
  if(file){
    if(file.size > 4*1024*1024){ err.textContent='File too large — please keep it under 4MB.'; err.style.display='block'; return; }
    const reader = new FileReader();
    reader.onload = () => finish(file.name, reader.result);
    reader.readAsDataURL(file);
  } else finish();
}
function viewCertificate(courseId){
  const c=getCourse(courseId); const u=getUser(session.id);
  const enr = DB.enrollments.find(e=>e.studentId===session.id && e.courseId===courseId);
  const certId = certIdFor(c.id, u.id);
  document.getElementById('cert-frame-content').innerHTML = `
    <div class="seal">🎓</div>
    <div class="title">Certificate of Completion</div>
    <p style="color:var(--muted);margin-top:14px;">This certifies that</p>
    <div class="name">${u.name}</div>
    <p style="color:var(--muted);">has successfully completed the course</p>
    <div class="course">"${c.title}"</div>
    <p style="font-size:12px;color:var(--muted);">Instructor: ${c.instructorName} &nbsp;|&nbsp; Quiz Score: ${enr.quizScore}% &nbsp;|&nbsp; Issued: ${fmtDate(enr.certIssuedAt||Date.now())}</p>
    <p style="margin-top:16px;font-weight:800;color:var(--p);">EduSphere</p>
    <p class="cert-id">Certificate ID: ${certId}</p>`;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-cert-detail').classList.add('active');
  document.getElementById('page-title').textContent='Certificate'; document.getElementById('page-sub').textContent=c.title;
}

/* ---- Notifications / Profile ---- */
function renderNotifications(){
  const list = DB.notifications.filter(n=>n.userId===session.id).sort((a,b)=>b.ts-a.ts);
  document.getElementById('s-notif-list').innerHTML = list.map(n=>`
    <div class="row-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
      <div><div style="font-size:13px;">${n.message}</div><div style="font-size:11px;color:var(--muted);">${fmtDate(n.ts)}</div></div>
    </div>`).join('');
  document.getElementById('s-notif-empty').classList.toggle('hidden', list.length>0);
}
function renderStudentProfile(){
  const u=getUser(session.id);
  document.getElementById('sp-name').value=u.name; document.getElementById('sp-email').value=u.email;
  document.getElementById('sp-ok').style.display='none';
}
function saveStudentProfile(){
  const u=getUser(session.id); u.name=document.getElementById('sp-name').value.trim()||u.name; saveDB();
  const ok=document.getElementById('sp-ok'); ok.textContent='Profile updated.'; ok.style.display='block';
  toast('Profile updated.','✅');
}

/* ===================== INSTRUCTOR ===================== */
function myCourses(){ return DB.courses.filter(c=>c.instructorId===session.id); }
function renderInstructorDashboard(){
  const courses = myCourses();
  const totalStudents = new Set(DB.enrollments.filter(e=>courses.some(c=>c.id===e.courseId)).map(e=>e.studentId)).size;
  const totalEnrollments = DB.enrollments.filter(e=>courses.some(c=>c.id===e.courseId)).length;
  const approved = courses.filter(c=>c.status==='approved').length;
  const myEnrs = DB.enrollments.filter(e=>courses.some(c=>c.id===e.courseId));
  const scored = myEnrs.filter(e=>e.quizScore!==null && e.quizScore!==undefined);
  const avgQuiz = scored.length ? Math.round(scored.reduce((s,e)=>s+e.quizScore,0)/scored.length) : null;
  document.getElementById('i-stat-cards').innerHTML = `
    <div class="card stat-card"><div class="k">My Courses</div><div class="v">${courses.length}</div></div>
    <div class="card stat-card"><div class="k">Approved</div><div class="v">${approved}</div></div>
    <div class="card stat-card"><div class="k">Total Students</div><div class="v">${totalStudents}</div></div>
    <div class="card stat-card"><div class="k">Total Enrollments</div><div class="v">${totalEnrollments}</div></div>
    <div class="card stat-card"><div class="k">Avg Quiz Score</div><div class="v">${avgQuiz!==null?avgQuiz+'%':'—'}</div></div>`;
  document.getElementById('i-dash-courses').innerHTML = courses.map(c=>instructorCourseCard(c)).join('') || '<div class="empty-state">No courses yet — create your first course!</div>';
}
function instructorCourseCard(c){
  const enrCount = DB.enrollments.filter(e=>e.courseId===c.id).length;
  const statusBadge = c.status==='approved'?'green':c.status==='pending'?'amber':'red';
  return `<div class="course-card"><div class="course-thumb">${c.thumb}</div><div class="course-body">
    <h4>${c.title}</h4><div class="course-meta"><span class="badge ${statusBadge}">${c.status}</span><span>${enrCount} students</span></div>
    <div class="course-foot"><button class="btn btn-outline btn-sm" onclick="openCourseForm('${c.id}')">Edit</button>
    <button class="btn btn-danger btn-sm" onclick="deleteCourse('${c.id}')">Delete</button></div></div></div>`;
}
function renderInstructorCourses(){ document.getElementById('i-courses-grid').innerHTML = myCourses().map(c=>instructorCourseCard(c)).join('') || '<div class="empty-state">No courses yet.</div>'; }
function deleteCourse(courseId){
  if(!confirm('Delete this course? This cannot be undone.')) return;
  DB.courses = DB.courses.filter(c=>c.id!==courseId);
  DB.enrollments = DB.enrollments.filter(e=>e.courseId!==courseId);
  saveDB(); renderInstructorCourses(); renderInstructorDashboard();
  toast('Course deleted.','🗑️');
}
function renderInstructorStudents(){
  const courses = myCourses();
  const sel = document.getElementById('is-course');
  if(sel.options.length===0 || sel.dataset.count!=courses.length){
    sel.innerHTML = '<option value="">All My Courses</option>' + courses.map(c=>`<option value="${c.id}">${c.title}</option>`).join('');
    sel.dataset.count = courses.length;
  }
  const courseId = sel.value;
  const courseIds = courses.map(c=>c.id);
  let enrs = DB.enrollments.filter(e=>courseIds.includes(e.courseId));
  if(courseId) enrs = enrs.filter(e=>e.courseId===courseId);
  const scored = enrs.filter(e=>e.quizScore!==null && e.quizScore!==undefined);
  const avgQuiz = scored.length ? Math.round(scored.reduce((s,e)=>s+e.quizScore,0)/scored.length) : null;
  const avgProgress = enrs.length ? Math.round(enrs.reduce((s,e)=>s+courseProgress(e),0)/enrs.length) : 0;
  const certCount = enrs.filter(e=>e.certificateIssued).length;
  document.getElementById('is-stat-cards').innerHTML = `
    <div class="card stat-card"><div class="k">Total Students</div><div class="v">${enrs.length}</div></div>
    <div class="card stat-card"><div class="k">Avg Progress</div><div class="v">${avgProgress}%</div></div>
    <div class="card stat-card"><div class="k">Avg Quiz Score</div><div class="v">${avgQuiz!==null?avgQuiz+'%':'—'}</div></div>
    <div class="card stat-card"><div class="k">Certificates Issued</div><div class="v">${certCount}</div></div>`;
  const showCourseCol = !courseId;
  const thCourse = document.getElementById('is-th-course');
  if(thCourse) thCourse.style.display = showCourseCol ? '' : 'none';
  document.getElementById('is-body').innerHTML = enrs.map(e=>{
    const s=getUser(e.studentId); const c=getCourse(e.courseId); const pct=courseProgress(e);
    return `<tr>${showCourseCol?`<td>${c?c.title:''}</td>`:''}<td>${s.name}</td><td><div class="progress-bar" style="width:100px;"><div class="fill" style="width:${pct}%"></div></div> ${pct}%</td>
      <td>${e.quizScore!==null && e.quizScore!==undefined ? e.quizScore+'%' : '—'}</td>
      <td><span class="badge ${e.certificateIssued?'green':'gray'}">${e.certificateIssued?'Completed':'In Progress'}</span></td></tr>`;
  }).join('');
  document.getElementById('is-empty').classList.toggle('hidden', enrs.length>0);
}
function renderInstructorProfile(){
  const u=getUser(session.id);
  document.getElementById('ip-name').value=u.name; document.getElementById('ip-email').value=u.email;
  document.getElementById('ip-ok').style.display='none';
}
function saveInstructorProfile(){
  const u=getUser(session.id); u.name=document.getElementById('ip-name').value.trim()||u.name; saveDB();
  const ok=document.getElementById('ip-ok'); ok.textContent='Profile updated.'; ok.style.display='block';
  toast('Profile updated.','✅');
}

/* ---- Course Create/Edit Form ---- */
let editingCourseId=null, formLessons=[], formQuestions=[];
function openCourseForm(courseId){
  editingCourseId=courseId||null;
  document.getElementById('cf-error').style.display='none';
  const catSel=document.getElementById('cf-cat'); catSel.innerHTML = DB.categories.map(c=>`<option>${c}</option>`).join('');
  if(courseId){
    const c=getCourse(courseId);
    document.getElementById('cf-title').textContent='Edit Course';
    document.getElementById('cf-title-input').value=c.title;
    catSel.value=c.category;
    document.getElementById('cf-desc').value=c.description;
    document.getElementById('cf-level').value=c.level;
    document.getElementById('cf-duration').value=c.duration;
    document.getElementById('cf-thumb').value=c.thumb;
    document.getElementById('cf-youtube').value=c.youtubeUrl||'';
    formLessons = JSON.parse(JSON.stringify(c.lessons));
    formQuestions = JSON.parse(JSON.stringify(c.quiz));
  }else{
    document.getElementById('cf-title').textContent='Create Course';
    document.getElementById('cf-title-input').value=''; document.getElementById('cf-desc').value='';
    document.getElementById('cf-level').value='Beginner'; document.getElementById('cf-duration').value='';
    document.getElementById('cf-thumb').value='📘';
    document.getElementById('cf-youtube').value='';
    formLessons=[]; formQuestions=[];
  }
  renderLessonFields(); renderQuestionFields();
  document.getElementById('course-modal').classList.add('show');
}
function closeCourseModal(){ document.getElementById('course-modal').classList.remove('show'); }
function addLessonField(){ formLessons.push({id:uid('les'), title:'', type:'video', duration:'', content:'', videoLink:'', pdfName:'', pdfData:''}); renderLessonFields(); }
function renderLessonFields(){
  document.getElementById('cf-lessons').innerHTML = formLessons.map((l,i)=>`
    <div class="lesson-form-item" style="flex-direction:column;align-items:stretch;gap:7px;">
      <div style="display:flex;gap:6px;">
        <input style="flex:1;padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);" placeholder="Lesson title" value="${l.title}" oninput="formLessons[${i}].title=this.value">
        <select style="padding:7px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);" onchange="formLessons[${i}].type=this.value">
          <option value="video" ${l.type==='video'?'selected':''}>Video</option><option value="notes" ${l.type==='notes'?'selected':''}>Notes</option>
        </select>
        <button class="btn btn-danger btn-sm" onclick="formLessons.splice(${i},1);renderLessonFields()">✕</button>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <input style="flex:1;min-width:160px;padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:12px;" placeholder="Video link (YouTube — optional)" value="${l.videoLink||''}" oninput="formLessons[${i}].videoLink=this.value">
        <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;">📄 ${l.pdfName?'Change PDF':'Upload PDF Notes'}<input type="file" accept="application/pdf" style="display:none;" onchange="uploadLessonPdf(${i},this)"></label>
        ${l.pdfName?`<span style="font-size:11px;color:var(--muted);">${l.pdfName}</span><button class="btn btn-danger btn-sm" onclick="formLessons[${i}].pdfName='';formLessons[${i}].pdfData='';renderLessonFields()">✕</button>`:''}
        <button class="btn btn-outline btn-sm" onclick="aiGenerateLessonNotes(${i})">✨ AI Notes</button>
      </div>
    </div>`).join('') || '<div style="font-size:12px;color:var(--muted);">No lessons added yet.</div>';
}
async function aiGenerateLessonNotes(i){
  const l = formLessons[i];
  if(!l.title.trim()){ toast('Add a lesson title first.','⚠️'); return; }
  toast('Generating notes…','✨');
  const prompt = `Write concise, well-structured study notes (120-180 words, plain text, no markdown headers) for a lesson titled "${l.title}" in an online course. Cover the key concepts a student should know.`;
  const text = await askAI(prompt);
  if(!text){ toast('AI generation failed. Try again.','⚠️'); return; }
  l.content = text;
  renderLessonFields();
  toast('Notes generated — edit the lesson to review.','✅');
}
async function aiGenerateQuiz(){
  const title = document.getElementById('cf-title-input').value.trim();
  const topics = formLessons.map(l=>l.title).filter(Boolean).join(', ');
  if(!title){ toast('Add a course title first.','⚠️'); return; }
  const btn = document.getElementById('ai-quiz-btn');
  btn.textContent='Generating…'; btn.disabled=true;
  const prompt = `Generate exactly 5 multiple-choice quiz questions for a course titled "${title}" covering topics: ${topics||title}. Respond ONLY with valid JSON, no markdown fences, no extra text, in this exact shape: [{"q":"question text","options":["a","b","c","d"],"answer":0}] where "answer" is the 0-based index of the correct option.`;
  try{
    const text = await askAI(prompt);
    if(!text) throw new Error('no response');
    const clean = text.trim().replace(/^```json\s*|```$/g,'');
    const parsed = JSON.parse(clean);
    parsed.forEach(q=>{ if(q.q && Array.isArray(q.options) && q.options.length===4){ formQuestions.push({id:uid('q'), q:q.q, options:q.options, answer:q.answer||0}); } });
    renderQuestionFields();
    toast('5 questions generated — review before saving.','✅');
  }catch(e){ toast('AI generation failed — please try again.','⚠️'); }
  btn.textContent='✨ AI Generate 5'; btn.disabled=false;
}
function uploadLessonPdf(i, input){
  const file = input.files[0]; if(!file) return;
  if(file.size > 4*1024*1024){ toast('PDF too large — please keep it under 4MB.','⚠️'); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = () => { formLessons[i].pdfName = file.name; formLessons[i].pdfData = reader.result; renderLessonFields(); toast('PDF attached to lesson.','📄'); };
  reader.readAsDataURL(file);
}
function addQuestionField(){ formQuestions.push({id:uid('q'), q:'', options:['','','',''], answer:0}); renderQuestionFields(); }
function renderQuestionFields(){
  document.getElementById('cf-questions').innerHTML = formQuestions.map((q,i)=>`
    <div class="q-form-item">
      <div style="display:flex;gap:6px;margin-bottom:6px;">
        <input style="flex:1;padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);" placeholder="Question" value="${q.q}" oninput="formQuestions[${i}].q=this.value">
        <button class="btn btn-danger btn-sm" onclick="formQuestions.splice(${i},1);renderQuestionFields()">✕</button>
      </div>
      <div class="grid2">
        ${q.options.map((o,oi)=>`<input style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:11.5px;" placeholder="Option ${oi+1}" value="${o}" oninput="formQuestions[${i}].options[${oi}]=this.value">`).join('')}
      </div>
      <div style="margin-top:6px;font-size:11.5px;">Correct answer:
        <select onchange="formQuestions[${i}].answer=+this.value">
          ${q.options.map((o,oi)=>`<option value="${oi}" ${q.answer===oi?'selected':''}>Option ${oi+1}</option>`).join('')}
        </select></div>
    </div>`).join('') || '<div style="font-size:12px;color:var(--muted);">No questions added yet.</div>';
}
function saveCourse(){
  const title=document.getElementById('cf-title-input').value.trim();
  const err=document.getElementById('cf-error');
  if(!title){ err.textContent='Course title is required.'; err.style.display='block'; return; }
  if(formLessons.some(l=>!l.title.trim())){ err.textContent='All lessons need a title.'; err.style.display='block'; return; }
  const payload = {
    title, category: document.getElementById('cf-cat').value, description: document.getElementById('cf-desc').value.trim(),
    level: document.getElementById('cf-level').value, duration: document.getElementById('cf-duration').value.trim() || '4 weeks',
    thumb: document.getElementById('cf-thumb').value.trim() || '📘',
    youtubeUrl: document.getElementById('cf-youtube').value.trim() || null,
    lessons: formLessons.map(l=>({...l, content: l.content || `Content for ${l.title}.`, duration: l.type==='video' ? (l.duration||'10 min') : ''})),
    quiz: formQuestions.filter(q=>q.q.trim()),
  };
  if(editingCourseId){
    const c=getCourse(editingCourseId); Object.assign(c, payload);
    toast('Course updated.','✅');
  }else{
    const u=getUser(session.id);
    DB.courses.push({id:uid('crs'), instructorId:session.id, instructorName:u.name, status:'pending', ...payload});
    toast('Course created — pending admin approval.','📚');
  }
  saveDB(); closeCourseModal(); renderInstructorCourses(); renderInstructorDashboard();
}

/* ---- Instructor Assignments ---- */
function renderInstructorAssignments(){
  const courses = myCourses();
  const sel = document.getElementById('ia-course-filter');
  if(sel.options.length!==courses.length+1){
    sel.innerHTML = '<option value="">All my courses</option>' + courses.map(c=>`<option value="${c.id}">${c.title}</option>`).join('');
  }
  const filterId = sel.value;
  const myCourseIds = courses.map(c=>c.id);
  let list = DB.assignments.filter(a=>myCourseIds.includes(a.courseId));
  if(filterId) list = list.filter(a=>a.courseId===filterId);
  document.getElementById('ia-list').innerHTML = list.map(a=>{
    const c = getCourse(a.courseId);
    const subCount = DB.submissions.filter(s=>s.assignmentId===a.id).length;
    const enrCount = DB.enrollments.filter(e=>e.courseId===a.courseId).length;
    return `<div class="panel" style="padding:12px;margin-bottom:10px;">
      <div class="row-between"><b>${a.title}</b><span class="badge gray">${c?c.title:''}</span></div>
      <p style="font-size:12.5px;color:var(--muted);margin:6px 0;">${a.description||''}</p>
      <div style="font-size:11.5px;color:var(--muted);">Due: ${a.dueDate||'—'} · Max Marks: ${a.maxMarks} · ${subCount}/${enrCount} submitted</div>
      <div class="actions" style="margin-top:10px;justify-content:flex-start;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="viewSubmissions('${a.id}')">View Submissions (${subCount})</button>
        ${a.pdfName?`<a href="${a.pdfData}" download="${a.pdfName}" class="btn btn-outline btn-sm">📄 ${a.pdfName}</a>`:''}
        <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${a.id}')">Delete</button>
      </div></div>`;
  }).join('');
  document.getElementById('ia-empty').classList.toggle('hidden', list.length>0);
}
let afPdfName='', afPdfData='';
function uploadAssignmentPdf(input){
  const file = input.files[0]; if(!file) return;
  if(file.size > 4*1024*1024){ toast('PDF too large — please keep it under 4MB.','⚠️'); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = () => { afPdfName=file.name; afPdfData=reader.result; document.getElementById('af-pdf-name').textContent=file.name; toast('PDF attached.','📄'); };
  reader.readAsDataURL(file);
}
function openAssignmentForm(){
  const courses = myCourses();
  document.getElementById('af-error').style.display='none';
  document.getElementById('af-course').innerHTML = courses.map(c=>`<option value="${c.id}">${c.title}</option>`).join('');
  document.getElementById('af-title').value=''; document.getElementById('af-desc').value='';
  document.getElementById('af-due').value=''; document.getElementById('af-marks').value=100;
  document.getElementById('af-pdf').value=''; document.getElementById('af-pdf-name').textContent='';
  afPdfName=''; afPdfData='';
  document.getElementById('assign-modal').classList.add('show');
}
function closeAssignModal(){ document.getElementById('assign-modal').classList.remove('show'); }
function saveAssignment(){
  const title = document.getElementById('af-title').value.trim();
  const err = document.getElementById('af-error');
  if(!title){ err.textContent='Assignment title is required.'; err.style.display='block'; return; }
  DB.assignments.push({
    id: uid('asg'), courseId: document.getElementById('af-course').value,
    title, description: document.getElementById('af-desc').value.trim(),
    dueDate: document.getElementById('af-due').value, maxMarks: +document.getElementById('af-marks').value || 100,
    pdfName: afPdfName, pdfData: afPdfData,
    createdAt: Date.now()
  });
  saveDB(); closeAssignModal(); renderInstructorAssignments();
  toast('Assignment created.','📝');
}
function deleteAssignment(id){
  if(!confirm('Delete this assignment and all its submissions?')) return;
  DB.assignments = DB.assignments.filter(a=>a.id!==id);
  DB.submissions = DB.submissions.filter(s=>s.assignmentId!==id);
  saveDB(); renderInstructorAssignments();
  toast('Assignment deleted.','🗑️');
}
function viewSubmissions(assignmentId){
  const a = DB.assignments.find(x=>x.id===assignmentId);
  document.getElementById('sub-title').textContent = 'Submissions — ' + a.title;
  const subs = DB.submissions.filter(s=>s.assignmentId===assignmentId);
  document.getElementById('sub-list').innerHTML = subs.map(s=>{
    const u = getUser(s.studentId);
    return `<div class="panel" style="padding:10px;margin-bottom:8px;">
      <div class="row-between"><b style="font-size:13px;">${u?u.name:'Unknown'}</b><span style="font-size:11px;color:var(--muted);">${new Date(s.submittedAt).toLocaleDateString()}</span></div>
      <p style="font-size:12.5px;margin:6px 0;">${s.text||'<i>No text submitted</i>'}</p>
      ${s.fileName?`<a href="${s.fileData}" download="${s.fileName}" style="font-size:12px;">📎 ${s.fileName}</a>`:''}
    </div>`;
  }).join('') || '<div class="empty-state">No submissions yet.</div>';
  document.getElementById('submissions-modal').classList.add('show');
}
function closeSubmissionsModal(){ document.getElementById('submissions-modal').classList.remove('show'); }

/* ===================== ADMIN ===================== */
function renderAdminDashboard(){
  const students = DB.users.filter(u=>u.role==='student').length;
  const instructors = DB.users.filter(u=>u.role==='instructor').length;
  const courses = DB.courses.length;
  const enrollments = DB.enrollments.length;
  const completed = DB.enrollments.filter(e=>e.certificateIssued).length;
  document.getElementById('a-stat-cards').innerHTML = `
    <div class="card stat-card"><div class="k">Total Students</div><div class="v">${students}</div></div>
    <div class="card stat-card"><div class="k">Total Instructors</div><div class="v">${instructors}</div></div>
    <div class="card stat-card"><div class="k">Total Courses</div><div class="v">${courses}</div></div>
    <div class="card stat-card"><div class="k">Total Enrollments</div><div class="v">${enrollments}</div></div>
    <div class="card stat-card"><div class="k">Completed Courses</div><div class="v">${completed}</div></div>
    <div class="card stat-card"><div class="k">Active Users</div><div class="v">${DB.users.length}</div></div>`;
  const perCourse = DB.courses.map(c=>({title:c.title, n: DB.enrollments.filter(e=>e.courseId===c.id).length})).sort((a,b)=>b.n-a.n).slice(0,6);
  const max = Math.max(1,...perCourse.map(x=>x.n));
  document.getElementById('a-chart').innerHTML = perCourse.map(x=>`<div class="bar" style="height:${Math.max(6,(x.n/max)*100)}%"><span>${x.n}</span></div>`).join('') || '<div class="empty-state">No enrollment data yet.</div>';
}
function renderAdminStudents(){
  const q=(document.getElementById('as-search').value||'').toLowerCase();
  const list = DB.users.filter(u=>u.role==='student' && (u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)));
  document.getElementById('as-body').innerHTML = list.map(u=>{
    const n = DB.enrollments.filter(e=>e.studentId===u.id).length;
    return `<tr><td>${u.name}</td><td>${u.email}</td><td>${n}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">Delete</button></td></tr>`;
  }).join('');
}
function renderAdminInstructors(){
  const q=(document.getElementById('ai-search').value||'').toLowerCase();
  const list = DB.users.filter(u=>u.role==='instructor' && (u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)));
  document.getElementById('ai-body').innerHTML = list.map(u=>{
    const n = DB.courses.filter(c=>c.instructorId===u.id).length;
    return `<tr><td>${u.name}</td><td>${u.email}</td><td>${n}</td>
      <td><span class="badge ${u.status==='approved'?'green':'amber'}">${u.status}</span></td>
      <td>${u.status==='pending' ? `<button class="btn btn-primary btn-sm" onclick="setInstructorStatus('${u.id}','approved')">Approve</button>
        <button class="btn btn-danger btn-sm" onclick="setInstructorStatus('${u.id}','rejected')">Reject</button>`
        : `<button class="btn btn-outline btn-sm" onclick="setInstructorStatus('${u.id}','${u.status==='approved'?'suspended':'approved'}')">${u.status==='approved'?'Suspend':'Reinstate'}</button>`}</td></tr>`;
  }).join('');
}
function setInstructorStatus(userId,status){ const u=getUser(userId); u.status=status; saveDB(); renderAdminInstructors(); toast('Instructor status updated.','✅'); }
function deleteUser(userId){
  if(!confirm('Delete this user?')) return;
  DB.users = DB.users.filter(u=>u.id!==userId);
  DB.enrollments = DB.enrollments.filter(e=>e.studentId!==userId);
  saveDB(); renderAdminStudents(); toast('User deleted.','🗑️');
}
function renderAdminCourses(){
  const q=(document.getElementById('ac-search').value||'').toLowerCase();
  const list = DB.courses.filter(c=>c.title.toLowerCase().includes(q));
  document.getElementById('ac-body').innerHTML = list.map(c=>{
    const n = DB.enrollments.filter(e=>e.courseId===c.id).length;
    const badge = c.status==='approved'?'green':c.status==='pending'?'amber':'red';
    return `<tr><td>${c.title}</td><td>${c.instructorName}</td><td>${c.category}</td><td>${n}</td>
      <td><span class="badge ${badge}">${c.status}</span></td>
      <td>${c.status==='pending' ? `<button class="btn btn-primary btn-sm" onclick="setCourseStatus('${c.id}','approved')">Approve</button>
        <button class="btn btn-danger btn-sm" onclick="setCourseStatus('${c.id}','rejected')">Reject</button>`
        : `<button class="btn btn-outline btn-sm" onclick="setCourseStatus('${c.id}','${c.status==='approved'?'rejected':'approved'}')">${c.status==='approved'?'Unpublish':'Approve'}</button>`}</td></tr>`;
  }).join('');
}
function setCourseStatus(courseId,status){ const c=getCourse(courseId); c.status=status; saveDB(); renderAdminCourses(); toast('Course status updated.','✅'); }
function renderAdminCategories(){
  document.getElementById('cat-manage-list').innerHTML = DB.categories.map(c=>`
    <span class="badge gray" style="font-size:12px;padding:7px 12px;">${c} <a href="#" style="color:var(--red);margin-left:6px;" onclick="removeCategory('${c}');return false;">✕</a></span>`).join('');
}
function addCategory(){
  const val=document.getElementById('new-cat').value.trim();
  if(!val) return;
  if(DB.categories.includes(val)){ toast('Category already exists.','⚠️'); return; }
  DB.categories.push(val); saveDB(); document.getElementById('new-cat').value=''; renderAdminCategories(); toast('Category added.','✅');
}
function removeCategory(cat){ DB.categories = DB.categories.filter(c=>c!==cat); saveDB(); renderAdminCategories(); }
function renderAdminFeedback(){
  document.getElementById('af-body').innerHTML = DB.feedback.map(f=>`<tr><td>${f.from}</td><td>${f.message}</td><td>${fmtDate(f.ts)}</td></tr>`).join('');
  document.getElementById('af-empty').classList.toggle('hidden', DB.feedback.length>0);
}
function renderAdminSettings(){
  document.getElementById('set-name').value=DB.settings.siteName;
  document.getElementById('set-tagline').value=DB.settings.tagline;
  document.getElementById('set-ok').style.display='none';
}
function saveSettings(){
  DB.settings.siteName=document.getElementById('set-name').value.trim()||DB.settings.siteName;
  DB.settings.tagline=document.getElementById('set-tagline').value.trim()||DB.settings.tagline;
  saveDB();
  const ok=document.getElementById('set-ok'); ok.textContent='Settings saved.'; ok.style.display='block';
  toast('Settings saved.','✅');
}

/* ===================== THEME ===================== */
function applyTheme(){
  let saved=null; try{ saved=localStorage.getItem('edusphere_theme'); }catch(e){}
  if(saved) document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-btn').textContent = (document.documentElement.getAttribute('data-theme')==='dark') ? '☀️' : '🌙';
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme');
  const next = cur==='dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try{ localStorage.setItem('edusphere_theme', next); }catch(e){}
  document.getElementById('theme-btn').textContent = next==='dark' ? '☀️' : '🌙';
}

/* ===================== AI CHAT ASSISTANT ===================== */
let aiChatHistory = [];
let aiSampleFn = null;
(async function initAiSample(){
  try{
    if(window.claude && window.claude.use){
      const sample = await window.claude.use('sample');
      if(sample) aiSampleFn = sample;
    }
  }catch(e){}
})();
const AI_PROXY_URL = 'https://fhmvghqkymtotglpxaev.supabase.co/functions/v1/ai-proxy';
async function askAI(prompt){
  if(aiSampleFn){
    try{ const res = await aiSampleFn(prompt, { modelTier: 'quick' }); if(res && res.text) return res.text; }catch(e){}
  }
  try{
    const r = await fetch(AI_PROXY_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json', 'apikey':SUPABASE_KEY, 'Authorization':'Bearer '+SUPABASE_KEY},
      body: JSON.stringify({prompt})
    });
    const data = await r.json();
    if(data && data.text) return data.text;
  }catch(e){}
  return null;
}
function toggleAiChat(){
  const panel = document.getElementById('ai-chat-panel');
  const open = panel.style.display==='flex';
  panel.style.display = open ? 'none' : 'flex';
  if(!open && aiChatHistory.length===0){
    appendAiMsg('assistant', "Hi! I'm your study assistant. Ask me anything about your enrolled courses, lesson topics, or how a concept works — I'll do my best to help.");
  }
}
function appendAiMsg(role, text){
  aiChatHistory.push({role, text});
  const box = document.getElementById('ai-chat-msgs');
  const bubble = document.createElement('div');
  bubble.style.cssText = role==='user'
    ? 'align-self:flex-end;background:var(--p);color:#fff;padding:8px 11px;border-radius:12px 12px 2px 12px;max-width:85%;'
    : 'align-self:flex-start;background:var(--bg);border:1px solid var(--border);padding:8px 11px;border-radius:12px 12px 12px 2px;max-width:88%;white-space:pre-wrap;';
  bubble.textContent = text;
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
  return bubble;
}
function localCourseContext(){
  if(!session) return '';
  const myCourseIds = (session.role==='student' ? myEnrollments().map(e=>e.courseId) : myCourses().map(c=>c.id));
  const courses = DB.courses.filter(c=>myCourseIds.includes(c.id));
  return courses.map(c=>`Course: ${c.title} (${c.category}). Lessons: ${c.lessons.map(l=>l.title).join(', ')}.`).join('\n');
}
function localFallbackAnswer(q){
  const ql = q.toLowerCase();
  let bestTitle=null, bestScore=-1;
  Object.keys(LESSON_NOTES).forEach(title=>{
    const tl = title.toLowerCase();
    let score=0;
    tl.split(/\s+/).forEach(w=>{ if(w.length>2 && ql.includes(w)) score+=2; });
    if(ql.includes(tl)) score+=5;
    const bodyText = LESSON_NOTES[title].replace(/<[^>]+>/g,' ').toLowerCase();
    ql.split(/\s+/).forEach(w=>{ if(w.length>3 && bodyText.includes(w)) score+=1; });
    if(score>bestScore){ bestScore=score; bestTitle=title; }
  });
  if(bestTitle && bestScore>=2){
    const plain = LESSON_NOTES[bestTitle].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    return `From "${bestTitle}" notes:\n\n${plain.slice(0,500)}${plain.length>500?'...':''}\n\n(Open that lesson's Notes tab for the full explanation.)`;
  }
  return "I couldn't find a close match in your course notes for that. Try asking about a specific lesson topic (e.g. \"what is a pointer\", \"explain flexbox\", \"what is SEO\"), or check the Notes tab inside that lesson.";
}
async function sendAiChat(){
  const input = document.getElementById('ai-chat-input');
  const q = input.value.trim();
  if(!q) return;
  input.value='';
  appendAiMsg('user', q);
  const thinking = appendAiMsg('assistant', 'Thinking…');
  const context = localCourseContext();
  const prompt = `You are a friendly study assistant inside an e-learning app called EduSphere. The student is enrolled in these courses:\n${context}\n\nAnswer their question clearly and concisely (under 150 words), focused on helping them learn. Question: ${q}`;
  const aiText = await askAI(prompt);
  const ans = aiText || localFallbackAnswer(q);
  thinking.textContent = ans;
  aiChatHistory[aiChatHistory.length-1].text = ans;
}

/* ===================== INIT ===================== */
(async function boot(){
  DB = await loadDBAsync();
  DB.assignments = DB.assignments || []; DB.submissions = DB.submissions || [];
  DB.wishlist = DB.wishlist || [];
  DB.users.forEach(ensureGam);
  saveDB();
  renderPublicSite();
  setLoginRole('student'); setRegRole('student');
})();
