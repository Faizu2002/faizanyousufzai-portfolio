(() => {
  "use strict";

  /* ==========================================
     CORE
  ========================================== */

  const sb = window.getSupabase();

  let session = null;
  let currentUser = null;
  let posts = [];

  let postDirty = false;
  let slugManuallyEdited = false;
  let currentPostOriginal = null;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const statusBox =
    document.getElementById("admin-status");


  /* ==========================================
     HELPERS
  ========================================== */

  const esc = value =>
    String(value ?? "")
      .replace(
        /[&<>"']/g,
        char =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
          })[char]
      );


  const fmt = value =>
    value
      ? new Intl.DateTimeFormat(
          undefined,
          {
            dateStyle: "medium"
          }
        ).format(
          new Date(value)
        )
      : "—";


  function show(
    message,
    type = "ok"
  ) {

    if (!statusBox) return;

    statusBox.textContent =
      message;

    statusBox.className =
      `admin-status show ${type}`;

    clearTimeout(
      show.timer
    );

    show.timer =
      setTimeout(
        () => {
          statusBox.className =
            "admin-status";
        },
        4500
      );
  }


  function slugify(value) {

    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9\s-]/g,
        ""
      )
      .trim()
      .replace(
        /\s+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(
        0,
        120
      );
  }


  function plainTextFromHtml(
    html
  ) {

    const div =
      document.createElement(
        "div"
      );

    div.innerHTML =
      html || "";

    return (
      div.textContent || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }


  async function api(
    path,
    options = {}
  ) {

    const headers = {
      "Content-Type":
        "application/json",
      ...(options.headers || {})
    };


    if (
      session?.access_token
    ) {

      headers.Authorization =
        `Bearer ${session.access_token}`;

    }


    const response =
      await fetch(
        path,
        {
          ...options,
          headers
        }
      );


    const data =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      if (
        path !== "/api/profile"
      ) {

        location.href =
          "/login/?next=/admin/";

      }

    }


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Request failed"
      );

    }


    return data;
  }


  /* ==========================================
     BOOT
  ========================================== */

  async function boot() {

    const {
      data
    } =
      await sb.auth
        .getSession();


    session =
      data.session;


    if (!session) {

      location.href =
        "/login/?next=/admin/";

      return;
    }


    const email =
      document.getElementById(
        "admin-email"
      );


    if (email) {

      email.textContent =
        session.user.email ||
        "";

    }


    const me =
      await api(
        "/api/profile"
      );


    if (
      me.profile?.role !==
      "admin"
    ) {

      location.href =
        "/account/";

      return;
    }


    currentUser =
      me.profile;


    await Promise.all([
      loadStats(),
      loadPosts(),
      loadComments(),
      loadUsers()
    ]);


    setupEnhancements();
  }


  /* ==========================================
     STATS
  ========================================== */

  async function loadStats() {

    try {

      const data =
        await api(
          "/api/admin/stats"
        );


      const users =
        document.getElementById(
          "stat-users"
        );

      const posts =
        document.getElementById(
          "stat-posts"
        );

      const comments =
        document.getElementById(
          "stat-comments"
        );

      const likes =
        document.getElementById(
          "stat-likes"
        );


      if (users) {
        users.textContent =
          data.users ?? 0;
      }


      if (posts) {
        posts.textContent =
          data.published_posts ??
          0;
      }


      if (comments) {
        comments.textContent =
          data.pending_comments ??
          0;
      }


      if (likes) {
        likes.textContent =
          data.likes ?? 0;
      }

    } catch (error) {

      show(
        error.message,
        "err"
      );

    }
  }


  /* ==========================================
     POSTS
  ========================================== */

  async function loadPosts() {

    try {

      const data =
        await api(
          "/api/admin/posts"
        );


      posts =
        data.posts || [];


      const body =
        document.getElementById(
          "posts-body"
        );


      if (!body) return;


      body.innerHTML =
        posts
          .map(post => {

            const source =
              post.source ||
              "database";


            return `
              <tr
                data-post-row
                data-post-status="${esc(post.status)}"
                data-post-source="${esc(source)}"
              >

                <td>

                  <strong>
                    ${esc(post.title)}
                  </strong>

                  <br>

                  <small>
                    /blog/${esc(post.slug)}
                  </small>

                </td>

                <td>

                  <span class="badge ${esc(post.status)}">
                    ${esc(post.status)}
                  </span>

                </td>

                <td>
                  ${esc(source)}
                </td>

                <td>
                  ${esc(
                    fmt(
                      post.updated_at ||
                      post.created_at
                    )
                  )}
                </td>

                <td>

                  <div class="row-actions">

                    <button
                      type="button"
                      data-edit-post="${esc(post.slug)}"
                    >
                      Edit
                    </button>

                    ${
                      source ===
                      "database"
                        ? `
                          <button
                            type="button"
                            data-delete-post="${esc(post.id)}"
                            class="danger"
                          >
                            Delete
                          </button>
                        `
                        : ""
                    }

                    <a
                      href="/blog/${esc(post.slug)}"
                      target="_blank"
                      rel="noopener"
                    >
                      View ↗
                    </a>

                  </div>

                </td>

              </tr>
            `;

          })
          .join("") ||
        `
          <tr>
            <td colspan="5">
              No posts.
            </td>
          </tr>
        `;


      applyPostFilters();

    } catch (error) {

      show(
        error.message,
        "err"
      );

    }
  }


  /* ==========================================
     COMMENTS
  ========================================== */

  async function loadComments() {

    try {

      const data =
        await api(
          "/api/admin/comments"
        );


      const body =
        document.getElementById(
          "comments-body"
        );


      if (!body) return;


      body.innerHTML =
        (data.comments || [])
          .map(comment => `
            <tr>

              <td>
                ${esc(
                  comment.display_name ||
                  comment.email ||
                  "Member"
                )}
              </td>

              <td>
                /blog/${esc(comment.post_slug)}
              </td>

              <td style="max-width:340px">
                ${esc(comment.comment_text)}
              </td>

              <td>

                <span class="badge ${esc(comment.status)}">
                  ${esc(comment.status)}
                </span>

              </td>

              <td>

                <div class="row-actions">

                  ${
                    comment.status !==
                    "approved"
                      ? `
                        <button
                          type="button"
                          data-comment-status="approved"
                          data-id="${esc(comment.id)}"
                        >
                          Approve
                        </button>
                      `
                      : ""
                  }

                  ${
                    comment.status !==
                    "spam"
                      ? `
                        <button
                          type="button"
                          data-comment-status="spam"
                          data-id="${esc(comment.id)}"
                        >
                          Spam
                        </button>
                      `
                      : ""
                  }

                  <button
                    type="button"
                    data-delete-comment="${esc(comment.id)}"
                    class="danger"
                  >
                    Delete
                  </button>

                </div>

              </td>

            </tr>
          `)
          .join("") ||
        `
          <tr>
            <td colspan="5">
              No comments.
            </td>
          </tr>
        `;

    } catch (error) {

      show(
        error.message,
        "err"
      );

    }
  }


  /* ==========================================
     USERS
  ========================================== */

  async function loadUsers() {

    try {

      const data =
        await api(
          "/api/admin/users"
        );


      const body =
        document.getElementById(
          "users-body"
        );


      if (!body) return;


      body.innerHTML =
        (data.users || [])
          .map(user => `
            <tr>

              <td>

                <strong>
                  ${esc(
                    user.display_name ||
                    "Member"
                  )}
                </strong>

                <br>

                <small>
                  ${esc(
                    user.email ||
                    user.id
                  )}
                </small>

              </td>

              <td>
                ${esc(user.role || "user")}
              </td>

              <td>

                <span class="badge ${
                  user.is_banned
                    ? "banned"
                    : "approved"
                }">

                  ${
                    user.is_banned
                      ? "Banned"
                      : "Active"
                  }

                </span>

              </td>

              <td>
                ${esc(fmt(user.created_at))}
              </td>

              <td>

                <div class="row-actions">

                  ${
                    user.id !==
                    session.user.id
                      ? `
                        <button
                          type="button"
                          data-ban-user="${esc(user.id)}"
                          data-banned="${
                            user.is_banned
                              ? "1"
                              : "0"
                          }"
                        >
                          ${
                            user.is_banned
                              ? "Unban"
                              : "Ban"
                          }
                        </button>

                        <button
                          type="button"
                          data-delete-user="${esc(user.id)}"
                          class="danger"
                        >
                          Delete
                        </button>
                      `
                      : "You"
                  }

                </div>

              </td>

            </tr>
          `)
          .join("") ||
        `
          <tr>
            <td colspan="5">
              No users.
            </td>
          </tr>
        `;

    } catch (error) {

      show(
        error.message,
        "err"
      );

    }
  }


  /* ==========================================
     NAVIGATION
  ========================================== */

  $$("[data-section]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          $$("[data-section]")
            .forEach(item =>
              item.classList
                .remove("active")
            );


          button.classList
            .add("active");


          $$(".admin-section")
            .forEach(panel =>
              panel.classList
                .remove("active")
            );


          const panel =
            document.querySelector(
              `[data-panel="${button.dataset.section}"]`
            );


          panel?.classList
            .add("active");


          const title =
            document.getElementById(
              "section-title"
            );


          const labels = {
            dashboard:
              "Dashboard",
            posts:
              "Blog Posts",
            comments:
              "Comments",
            users:
              "Users"
          };


          if (title) {

            title.textContent =
              labels[
                button.dataset.section
              ] ||
              button.dataset.section;

          }


          document
            .getElementById(
              "admin-side"
            )
            ?.classList
            .remove("open");

        }
      );

    });


  document
    .getElementById(
      "admin-menu"
    )
    ?.addEventListener(
      "click",
      () =>
        document
          .getElementById(
            "admin-side"
          )
          ?.classList
          .toggle("open")
    );


  document
    .getElementById(
      "admin-logout"
    )
    ?.addEventListener(
      "click",
      async () => {

        await sb.auth
          .signOut();

        location.href =
          "/login/";

      }
    );


  /* ==========================================
     MODALS
  ========================================== */

  $$("[data-close]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const modal =
            document.getElementById(
              button.dataset.close
            );


          if (
            button.dataset.close ===
              "post-modal" &&
            postDirty
          ) {

            const ok =
              confirm(
                "You have unsaved changes. Close the editor?"
              );


            if (!ok) return;

          }


          modal?.classList
            .remove("open");


          if (
            button.dataset.close ===
            "post-modal"
          ) {

            postDirty =
              false;

          }

        }
      );

    });


  /* ==========================================
     CREATE USER
  ========================================== */

  document
    .getElementById(
      "new-user"
    )
    ?.addEventListener(
      "click",
      () => {

        document
          .getElementById(
            "user-modal"
          )
          ?.classList
          .add("open");

      }
    );


  document
    .getElementById(
      "user-form"
    )
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const form =
          event.currentTarget;


        try {

          await api(
            "/api/admin/users",
            {
              method: "POST",

              body:
                JSON.stringify({
                  display_name:
                    form
                      .display_name
                      .value
                      .trim(),

                  email:
                    form
                      .email
                      .value
                      .trim(),

                  password:
                    form
                      .password
                      .value
                })
            }
          );


          form.reset();


          document
            .getElementById(
              "user-modal"
            )
            ?.classList
            .remove("open");


          show(
            "User created."
          );


          await Promise.all([
            loadUsers(),
            loadStats()
          ]);

        } catch (error) {

          show(
            error.message,
            "err"
          );

        }

      }
    );


  /* ==========================================
     POST EDITOR CORE
  ========================================== */

  const postModal =
    document.getElementById(
      "post-modal"
    );

  const postForm =
    document.getElementById(
      "post-form"
    );

  const editor =
    document.getElementById(
      "post-editor"
    );


  const pf =
    name =>
      postForm
        ?.elements
        .namedItem(name);


  function openPost(
    post = null
  ) {

    if (
      !postForm ||
      !editor
    ) {
      return;
    }


    postForm.reset();

    editor.innerHTML = "";

    pf("id").value =
      "";

    delete pf("slug")
      .dataset.touched;


    slugManuallyEdited =
      false;

    postDirty =
      false;

    currentPostOriginal =
      post
        ? JSON.parse(
            JSON.stringify(post)
          )
        : null;


    const title =
      document.getElementById(
        "post-modal-title"
      );


    if (title) {

      title.textContent =
        post
          ? "Edit post"
          : "New post";

    }


    if (post) {

      [
        "id",
        "title",
        "slug",
        "primary_keyword",
        "status",
        "excerpt",
        "meta_title",
        "meta_description",
        "featured_image"
      ]
        .forEach(key => {

          if (pf(key)) {

            pf(key).value =
              post[key] || "";

          }

        });


      editor.innerHTML =
        post.content || "";


      pf("slug")
        .dataset.touched =
        "1";


      slugManuallyEdited =
        true;

    }


    postModal?.classList
      .add("open");


    setTimeout(
      () => {

        updateEditorUI();

        pf("title")
          ?.focus();

      },
      30
    );
  }


  document
    .getElementById(
      "new-post"
    )
    ?.addEventListener(
      "click",
      () =>
        openPost()
    );


  pf("title")
    ?.addEventListener(
      "input",
      () => {

        if (
          !pf("id").value &&
          !pf("slug")
            .dataset.touched &&
          !slugManuallyEdited
        ) {

          pf("slug").value =
            slugify(
              pf("title").value
            );

        }


        markPostDirty();

        updateEditorUI();

      }
    );


  pf("slug")
    ?.addEventListener(
      "input",
      () => {

        pf("slug")
          .dataset.touched =
          "1";

        slugManuallyEdited =
          true;

        pf("slug").value =
          slugify(
            pf("slug").value
          );


        markPostDirty();

        updateEditorUI();

      }
    );


  /* ==========================================
     EDITOR TOOLBAR
  ========================================== */

  $$(".admin-editor-toolbar button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          editor?.focus();


          const command =
            button.dataset.cmd;


          if (!command) {
            return;
          }


          if (
            command ===
            "createLink"
          ) {

            const url =
              prompt(
                "Link URL:"
              );


            if (url) {

              document.execCommand(
                "createLink",
                false,
                url
              );

            }

          } else {

            document.execCommand(
              command,
              false,
              button.dataset.val ||
              null
            );

          }


          markPostDirty();

          updateEditorUI();

        }
      );

    });


  /* ==========================================
     PREVIEW
  ========================================== */

  document
    .getElementById(
      "preview-post"
    )
    ?.addEventListener(
      "click",
      () => {

        const preview =
          document.getElementById(
            "post-preview"
          );


        if (preview) {

          preview.innerHTML = `
            <h1>
              ${esc(
                pf("title").value ||
                "Untitled article"
              )}
            </h1>

            ${
              pf("excerpt")
                .value
                .trim()
                ? `
                  <p>
                    <strong>
                      ${esc(
                        pf("excerpt")
                          .value
                          .trim()
                      )}
                    </strong>
                  </p>
                `
                : ""
            }

            ${editor.innerHTML}
          `;

        }


        document
          .getElementById(
            "preview-modal"
          )
          ?.classList
          .add("open");

      }
    );


  /* ==========================================
     IMAGE UPLOAD
  ========================================== */

  document
    .getElementById(
      "post-image-file"
    )
    ?.addEventListener(
      "change",
      async event => {

        const file =
          event.target
            .files?.[0];


        if (!file) return;


        if (
          file.size >
          5 * 1024 * 1024
        ) {

          show(
            "Image must be under 5 MB.",
            "err"
          );

          return;
        }


        if (
          ![
            "image/jpeg",
            "image/png",
            "image/webp"
          ].includes(
            file.type
          )
        ) {

          show(
            "Only JPG, PNG or WebP images are allowed.",
            "err"
          );

          return;
        }


        const ext =
          (
            file.name
              .split(".")
              .pop() ||
            "webp"
          )
            .toLowerCase();


        const path =
          `posts/${
            Date.now()
          }-${
            Math.random()
              .toString(36)
              .slice(2, 8)
          }.${ext}`;


        show(
          "Uploading image..."
        );


        const {
          error
        } =
          await sb.storage
            .from(
              "blog-images"
            )
            .upload(
              path,
              file,
              {
                cacheControl:
                  "3600",

                upsert:
                  false
              }
            );


        if (error) {

          show(
            error.message,
            "err"
          );

          return;
        }


        const {
          data
        } =
          sb.storage
            .from(
              "blog-images"
            )
            .getPublicUrl(
              path
            );


        pf(
          "featured_image"
        ).value =
          data.publicUrl;


        markPostDirty();

        updateEditorUI();


        show(
          "Image uploaded."
        );

      }
    );


  /* ==========================================
     SAVE POST
  ========================================== */

  postForm
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const payload = {

          id:
            pf("id").value ||
            null,

          title:
            pf("title")
              .value
              .trim(),

          slug:
            pf("slug")
              .value
              .trim(),

          primary_keyword:
            pf(
              "primary_keyword"
            )
              .value
              .trim(),

          status:
            pf("status").value,

          excerpt:
            pf("excerpt")
              .value
              .trim(),

          meta_title:
            pf("meta_title")
              .value
              .trim(),

          meta_description:
            pf(
              "meta_description"
            )
              .value
              .trim(),

          featured_image:
            pf(
              "featured_image"
            )
              .value
              .trim(),

          content:
            editor.innerHTML
              .trim()
        };


        try {

          const submitButton =
            postForm
              .querySelector(
                'button[type="submit"]'
              );


          const originalText =
            submitButton
              ?.textContent;


          if (submitButton) {

            submitButton.disabled =
              true;

            submitButton.textContent =
              payload.status ===
              "published"
                ? "Publishing..."
                : "Saving...";

          }


          await api(
            "/api/admin/posts",
            {
              method:
                payload.id
                  ? "PATCH"
                  : "POST",

              body:
                JSON.stringify(
                  payload
                )
            }
          );


          postDirty =
            false;


          postModal
            ?.classList
            .remove("open");


          show(
            payload.status ===
            "published"
              ? "Post published and synced."
              : "Draft saved."
          );


          await Promise.all([
            loadPosts(),
            loadStats()
          ]);


          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              originalText ||
              "Save post";

          }

        } catch (error) {

          const submitButton =
            postForm
              .querySelector(
                'button[type="submit"]'
              );


          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              "Save post";

          }


          show(
            error.message,
            "err"
          );

        }

      }
    );


  /* ==========================================
     POSTS ACTIONS
  ========================================== */

  document
    .getElementById(
      "posts-body"
    )
    ?.addEventListener(
      "click",
      async event => {

        const target =
          event.target.closest(
            "button"
          ) ||
          event.target;


        const slug =
          target.dataset
            ?.editPost;


        if (slug) {

          let post =
            posts.find(
              item =>
                item.slug === slug
            );


          try {

            if (!post) {

              throw new Error(
                "Post not found."
              );

            }


            if (
              post.source ===
              "static"
            ) {

              show(
                "Importing existing article..."
              );


              const data =
                await api(
                  "/api/admin/posts/import",
                  {
                    method:
                      "POST",

                    body:
                      JSON.stringify({
                        slug
                      })
                  }
                );


              post =
                data.post;


              await loadPosts();

            } else {

              const data =
                await api(
                  `/api/admin/posts?slug=${
                    encodeURIComponent(
                      slug
                    )
                  }`
                );


              post =
                data.post;

            }


            openPost(
              post
            );

          } catch (error) {

            show(
              error.message,
              "err"
            );

          }


          return;
        }


        const id =
          target.dataset
            ?.deletePost;


        if (id) {

          const post =
            posts.find(
              item =>
                item.id === id
            );


          const ok =
            confirm(
              post
                ? `Delete "${post.title}" permanently?`
                : "Delete this database post?"
            );


          if (!ok) return;


          try {

            show(
              "Deleting post..."
            );


            await api(
              "/api/admin/posts",
              {
                method:
                  "DELETE",

                body:
                  JSON.stringify({
                    id
                  })
              }
            );


            show(
              "Post deleted."
            );


            await Promise.all([
              loadPosts(),
              loadStats()
            ]);

          } catch (error) {

            show(
              error.message,
              "err"
            );

          }

        }

      }
    );


  /* ==========================================
     COMMENT ACTIONS
  ========================================== */

  document
    .getElementById(
      "comments-body"
    )
    ?.addEventListener(
      "click",
      async event => {

        const target =
          event.target.closest(
            "button"
          ) ||
          event.target;


        const id =
          target.dataset?.id;

        const statusValue =
          target.dataset
            ?.commentStatus;


        if (
          id &&
          statusValue
        ) {

          try {

            await api(
              "/api/admin/comments",
              {
                method:
                  "PATCH",

                body:
                  JSON.stringify({
                    id,
                    status:
                      statusValue
                  })
              }
            );


            show(
              `Comment marked ${statusValue}.`
            );


            await Promise.all([
              loadComments(),
              loadStats()
            ]);

          } catch (error) {

            show(
              error.message,
              "err"
            );

          }


          return;
        }


        const deleteId =
          target.dataset
            ?.deleteComment;


        if (deleteId) {

          if (
            !confirm(
              "Delete comment?"
            )
          ) {
            return;
          }


          try {

            await api(
              "/api/admin/comments",
              {
                method:
                  "DELETE",

                body:
                  JSON.stringify({
                    id:
                      deleteId
                  })
              }
            );


            show(
              "Comment deleted."
            );


            await Promise.all([
              loadComments(),
              loadStats()
            ]);

          } catch (error) {

            show(
              error.message,
              "err"
            );

          }

        }

      }
    );


  document
    .getElementById(
      "refresh-comments"
    )
    ?.addEventListener(
      "click",
      loadComments
    );


  /* ==========================================
     USER ACTIONS
  ========================================== */

  document
    .getElementById(
      "users-body"
    )
    ?.addEventListener(
      "click",
      async event => {

        const target =
          event.target.closest(
            "button"
          ) ||
          event.target;


        const id =
          target.dataset
            ?.banUser;


        if (id) {

          try {

            const banning =
              target.dataset
                .banned !==
              "1";


            await api(
              "/api/admin/users",
              {
                method:
                  "PATCH",

                body:
                  JSON.stringify({
                    id,
                    banned:
                      banning
                  })
              }
            );


            show(
              banning
                ? "User banned."
                : "User unbanned."
            );


            await loadUsers();

          } catch (error) {

            show(
              error.message,
              "err"
            );

          }


          return;
        }


        const deleteId =
          target.dataset
            ?.deleteUser;


        if (deleteId) {

          if (
            !confirm(
              "Permanently delete this user and their comments/likes?"
            )
          ) {
            return;
          }


          try {

            await api(
              "/api/admin/users",
              {
                method:
                  "DELETE",

                body:
                  JSON.stringify({
                    id:
                      deleteId
                  })
              }
            );


            show(
              "User deleted."
            );


            await Promise.all([
              loadUsers(),
              loadStats(),
              loadComments()
            ]);

          } catch (error) {

            show(
              error.message,
              "err"
            );

          }

        }

      }
    );


  /* ==========================================
     MODERN EDITOR ENHANCEMENTS
  ========================================== */

  function setupEnhancements() {

    if (
      !postForm ||
      !editor
    ) {
      return;
    }


    injectEnhancementStyles();

    setupEditorToolbar();

    setupEditorStats();

    setupSeoAssistant();

    setupSerpPreview();

    setupFeaturedImagePreview();

    setupFieldCounters();

    setupPostSearch();

    setupDirtyTracking();

    setupKeyboardShortcuts();

    updateEditorUI();

  }


  /* ==========================================
     ENHANCEMENT CSS
  ========================================== */

  function injectEnhancementStyles() {

    if (
      document.getElementById(
        "admin-enhancement-styles"
      )
    ) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "admin-enhancement-styles";


    style.textContent = `

      .editor-insights{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }

      .editor-insight{
        padding:9px 10px;
        border:1px solid #e1e7e3;
        border-radius:10px;
        background:#f7faf8;
      }

      .editor-insight span{
        display:block;
        color:#77827d;
        font-size:.64rem;
        font-weight:850;
        text-transform:uppercase;
        letter-spacing:.07em;
      }

      .editor-insight strong{
        display:block;
        margin-top:3px;
        font-size:.9rem;
      }

      .seo-assistant{
        margin-top:22px;
        border:1px solid #e0e6e2;
        border-radius:15px;
        overflow:hidden;
        background:#fff;
      }

      .seo-assistant-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:15px;
        padding:14px 16px;
        background:#f8faf9;
        border-bottom:1px solid #e3e8e5;
      }

      .seo-assistant-head h3{
        margin:3px 0 0;
        font-size:.95rem;
      }

      .seo-score{
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        flex:0 0 48px;
        border-radius:50%;
        background:#edf2ef;
        font-size:.76rem;
        font-weight:900;
      }

      .seo-score.good{
        color:#087252;
        background:#e4f6ee;
      }

      .seo-score.medium{
        color:#795b00;
        background:#fff3d3;
      }

      .seo-score.bad{
        color:#962d2d;
        background:#ffeaea;
      }

      .seo-checks{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:7px;
        padding:14px;
      }

      .seo-check{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:8px 9px;
        border:1px solid #edf0ee;
        border-radius:9px;
        font-size:.73rem;
        line-height:1.4;
      }

      .seo-check-icon{
        width:18px;
        height:18px;
        display:grid;
        place-items:center;
        flex:0 0 18px;
        border-radius:50%;
        background:#edf1ef;
        font-size:.61rem;
        font-weight:900;
      }

      .seo-check.pass .seo-check-icon{
        color:#087252;
        background:#def4e9;
      }

      .seo-check.fail .seo-check-icon{
        color:#896000;
        background:#fff0df;
      }

      .google-preview{
        margin-top:14px;
        padding:15px;
        border:1px solid #e0e6e2;
        border-radius:14px;
        background:#fff;
      }

      .google-preview-label{
        margin-bottom:11px;
        color:#7d8983;
        font-size:.65rem;
        font-weight:850;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .google-preview-url{
        margin-bottom:5px;
        color:#202124;
        font-size:.72rem;
      }

      .google-preview-title{
        margin-bottom:5px;
        color:#1a0dab;
        font-size:1.08rem;
        line-height:1.3;
      }

      .google-preview-description{
        color:#4d5156;
        font-size:.78rem;
        line-height:1.5;
      }

      .field-counter{
        margin-top:2px;
        color:#8b9691;
        font-size:.64rem;
        text-align:right;
      }

      .field-counter.good{
        color:#087252;
      }

      .field-counter.warn{
        color:#966800;
      }

      .featured-preview{
        display:none;
        width:100%;
        max-width:420px;
        margin-top:10px;
        overflow:hidden;
        border:1px solid #e1e6e3;
        border-radius:12px;
        background:#f5f7f6;
      }

      .featured-preview.show{
        display:block;
      }

      .featured-preview img{
        display:block;
        width:100%;
        max-height:220px;
        object-fit:cover;
      }

      .featured-preview-error{
        padding:12px;
        color:#8c3030;
        font-size:.72rem;
      }

      .toolbar-enhanced-divider{
        width:1px;
        height:20px;
        margin:0 2px;
        background:#d9e0dc;
      }

      .post-editor-fullscreen{
        position:fixed!important;
        inset:12px!important;
        z-index:9999!important;
        width:auto!important;
        max-width:none!important;
        height:calc(100vh - 24px)!important;
        max-height:none!important;
        display:flex!important;
        flex-direction:column!important;
      }

      .post-editor-fullscreen #post-form{
        min-height:0;
        overflow:auto;
      }

      .post-editor-fullscreen .admin-editor{
        min-height:55vh;
      }

      .posts-tools{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        padding:0 20px 16px;
      }

      .posts-tools input,
      .posts-tools select{
        min-height:38px;
        padding:8px 10px;
        border:1px solid #d8dfdb;
        border-radius:10px;
        outline:none;
        background:#fff;
        font:inherit;
        font-size:.78rem;
      }

      .posts-tools input{
        flex:1;
        min-width:220px;
      }

      .posts-tools input:focus,
      .posts-tools select:focus{
        border-color:#85968d;
        box-shadow:0 0 0 3px rgba(60,91,77,.08);
      }

      .editor-live-status{
        display:flex;
        align-items:center;
        gap:6px;
        margin-left:auto;
        padding:0 6px;
        color:#7c8782;
        font-size:.66rem;
        font-weight:700;
      }

      .editor-live-dot{
        width:6px;
        height:6px;
        border-radius:50%;
        background:#9aa49f;
      }

      .editor-live-status.dirty .editor-live-dot{
        background:#d49c22;
      }

      .editor-live-status.saved .editor-live-dot{
        background:#18a36d;
      }

      @media(max-width:700px){

        .editor-insights{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .seo-checks{
          grid-template-columns:1fr;
        }

      }

    `;


    document.head
      .appendChild(style);
  }


  /* ==========================================
     EXTRA TOOLBAR
  ========================================== */

  function setupEditorToolbar() {

    const toolbar =
      document.querySelector(
        ".admin-editor-toolbar"
      );


    if (
      !toolbar ||
      toolbar.dataset.enhanced
    ) {
      return;
    }


    toolbar.dataset.enhanced =
      "1";


    const divider =
      () => {

        const element =
          document.createElement(
            "span"
          );

        element.className =
          "toolbar-enhanced-divider";

        return element;
      };


    const button =
      (
        label,
        title,
        action
      ) => {

        const element =
          document.createElement(
            "button"
          );


        element.type =
          "button";

        element.textContent =
          label;

        element.title =
          title;


        element.addEventListener(
          "click",
          () => {

            editor.focus();

            action();

            markPostDirty();

            updateEditorUI();

          }
        );


        return element;
      };


    toolbar.appendChild(
      divider()
    );


    toolbar.appendChild(
      button(
        "H4",
        "Heading 4",
        () =>
          document.execCommand(
            "formatBlock",
            false,
            "h4"
          )
      )
    );


    toolbar.appendChild(
      button(
        "1. List",
        "Numbered list",
        () =>
          document.execCommand(
            "insertOrderedList"
          )
      )
    );


    toolbar.appendChild(
      button(
        "Quote",
        "Blockquote",
        () =>
          document.execCommand(
            "formatBlock",
            false,
            "blockquote"
          )
      )
    );


    toolbar.appendChild(
      button(
        "—",
        "Horizontal line",
        () =>
          document.execCommand(
            "insertHorizontalRule"
          )
      )
    );


    toolbar.appendChild(
      divider()
    );


    toolbar.appendChild(
      button(
        "↶",
        "Undo",
        () =>
          document.execCommand(
            "undo"
          )
      )
    );


    toolbar.appendChild(
      button(
        "↷",
        "Redo",
        () =>
          document.execCommand(
            "redo"
          )
      )
    );


    toolbar.appendChild(
      button(
        "Clear",
        "Remove formatting",
        () =>
          document.execCommand(
            "removeFormat"
          )
      )
    );


    toolbar.appendChild(
      button(
        "⛶",
        "Fullscreen editor",
        toggleEditorFullscreen
      )
    );


    const liveStatus =
      document.createElement(
        "span"
      );


    liveStatus.className =
      "editor-live-status saved";

    liveStatus.id =
      "editor-live-status";

    liveStatus.innerHTML = `
      <span class="editor-live-dot"></span>
      <span data-editor-save-state>
        Saved
      </span>
    `;


    toolbar.appendChild(
      liveStatus
    );
  }


  function toggleEditorFullscreen() {

    const modalCard =
      document.querySelector(
        "#post-modal .modal-card"
      );


    modalCard?.classList
      .toggle(
        "post-editor-fullscreen"
      );
  }


  /* ==========================================
     EDITOR STATS
  ========================================== */

  function setupEditorStats() {

    if (
      document.getElementById(
        "editor-insights"
      )
    ) {
      return;
    }


    const shell =
      editor.closest(
        ".admin-editor-shell"
      ) ||
      editor;


    const insights =
      document.createElement(
        "div"
      );


    insights.id =
      "editor-insights";

    insights.className =
      "editor-insights";


    insights.innerHTML = `

      <div class="editor-insight">
        <span>Words</span>
        <strong id="editor-word-count">0</strong>
      </div>

      <div class="editor-insight">
        <span>Reading time</span>
        <strong id="editor-reading-time">0 min</strong>
      </div>

      <div class="editor-insight">
        <span>Headings</span>
        <strong id="editor-heading-count">0</strong>
      </div>

      <div class="editor-insight">
        <span>Links</span>
        <strong id="editor-link-count">0</strong>
      </div>

    `;


    shell.insertAdjacentElement(
      "afterend",
      insights
    );


    editor.addEventListener(
      "input",
      () => {

        markPostDirty();

        updateEditorUI();

      }
    );


    editor.addEventListener(
      "paste",
      () =>
        setTimeout(
          () => {

            markPostDirty();

            updateEditorUI();

          },
          20
        )
    );
  }


  function editorWords() {

    const text =
      plainTextFromHtml(
        editor?.innerHTML ||
        ""
      );


    return text
      ? text.split(/\s+/)
      : [];
  }


  function updateEditorStats() {

    const words =
      editorWords().length;


    const readingTime =
      words
        ? Math.max(
            1,
            Math.ceil(
              words / 220
            )
          )
        : 0;


    const headings =
      editor
        ? editor.querySelectorAll(
            "h2,h3,h4"
          ).length
        : 0;


    const links =
      editor
        ? editor.querySelectorAll(
            "a"
          ).length
        : 0;


    const wordElement =
      document.getElementById(
        "editor-word-count"
      );

    const timeElement =
      document.getElementById(
        "editor-reading-time"
      );

    const headingElement =
      document.getElementById(
        "editor-heading-count"
      );

    const linkElement =
      document.getElementById(
        "editor-link-count"
      );


    if (wordElement) {
      wordElement.textContent =
        words;
    }


    if (timeElement) {
      timeElement.textContent =
        `${readingTime} min`;
    }


    if (headingElement) {
      headingElement.textContent =
        headings;
    }


    if (linkElement) {
      linkElement.textContent =
        links;
    }
  }


  /* ==========================================
     SERP PREVIEW
  ========================================== */

  function setupSerpPreview() {

    if (
      document.getElementById(
        "google-preview"
      )
    ) {
      return;
    }


    const metaDescription =
      pf(
        "meta_description"
      );


    const grid =
      metaDescription
        ?.closest(
          ".admin-form-grid"
        );


    if (!grid) return;


    const preview =
      document.createElement(
        "div"
      );


    preview.id =
      "google-preview";

    preview.className =
      "google-preview";


    grid.insertAdjacentElement(
      "afterend",
      preview
    );
  }


  function updateSerpPreview() {

    const preview =
      document.getElementById(
        "google-preview"
      );


    if (!preview) return;


    const title =
      pf("meta_title")
        ?.value
        .trim() ||
      pf("title")
        ?.value
        .trim() ||
      "Article title";


    const description =
      pf("meta_description")
        ?.value
        .trim() ||
      pf("excerpt")
        ?.value
        .trim() ||
      "Your meta description will appear here.";


    const slug =
      pf("slug")
        ?.value
        .trim() ||
      "article-slug";


    preview.innerHTML = `

      <div class="google-preview-label">
        Google Search Preview
      </div>

      <div class="google-preview-url">
        faizanyousufzai.online › blog › ${esc(slug)}
      </div>

      <div class="google-preview-title">
        ${esc(title)}
      </div>

      <div class="google-preview-description">
        ${esc(description)}
      </div>

    `;
  }


  /* ==========================================
     SEO ASSISTANT
  ========================================== */

  function setupSeoAssistant() {

    if (
      document.getElementById(
        "seo-assistant"
      )
    ) {
      return;
    }


    const footer =
      document.querySelector(
        ".post-form-footer"
      );


    if (!footer) return;


    const section =
      document.createElement(
        "section"
      );


    section.id =
      "seo-assistant";

    section.className =
      "seo-assistant";


    footer.insertAdjacentElement(
      "beforebegin",
      section
    );
  }


  function keywordAppears(
    value
  ) {

    const key =
      pf(
        "primary_keyword"
      )
        ?.value
        .trim()
        .toLowerCase();


    if (!key) {
      return false;
    }


    return String(
      value || ""
    )
      .toLowerCase()
      .includes(key);
  }


  function seoCheckHtml(
    pass,
    label
  ) {

    return `

      <div class="seo-check ${pass ? "pass" : "fail"}">

        <span class="seo-check-icon">
          ${pass ? "✓" : "!"}
        </span>

        <span>
          ${esc(label)}
        </span>

      </div>

    `;
  }


  function updateSeoAssistant() {

    const section =
      document.getElementById(
        "seo-assistant"
      );


    if (!section) return;


    const title =
      pf("title")
        ?.value || "";


    const slug =
      pf("slug")
        ?.value || "";


    const keyword =
      pf(
        "primary_keyword"
      )
        ?.value
        .trim() || "";


    const metaTitle =
      pf("meta_title")
        ?.value || "";


    const metaDescription =
      pf(
        "meta_description"
      )
        ?.value || "";


    const excerpt =
      pf("excerpt")
        ?.value || "";


    const words =
      editorWords();


    const wordCount =
      words.length;


    const intro =
      words
        .slice(0, 150)
        .join(" ");


    const headingElements =
      editor
        ? [
            ...editor.querySelectorAll(
              "h2,h3,h4"
            )
          ]
        : [];


    const headingText =
      headingElements
        .map(
          element =>
            element.textContent ||
            ""
        )
        .join(" ");


    const links =
      editor
        ? editor.querySelectorAll(
            "a"
          ).length
        : 0;


    const checks = [

      {
        pass:
          title.trim().length >=
          20,

        label:
          "Article title is descriptive"
      },

      {
        pass:
          metaTitle.length >= 45 &&
          metaTitle.length <= 60,

        label:
          "Meta title is around 45–60 characters"
      },

      {
        pass:
          metaDescription.length >=
            120 &&
          metaDescription.length <=
            160,

        label:
          "Meta description is around 120–160 characters"
      },

      {
        pass:
          excerpt.trim().length >=
          60,

        label:
          "Article excerpt is added"
      },

      {
        pass:
          wordCount >= 800,

        label:
          "Article contains at least 800 words"
      },

      {
        pass:
          headingElements.length >=
          2,

        label:
          "Article uses useful subheadings"
      },

      {
        pass:
          links >= 1,

        label:
          "Article contains at least one link"
      },

      {
        pass:
          !!pf(
            "featured_image"
          )
            ?.value
            .trim(),

        label:
          "Featured image is added"
      }

    ];


    if (keyword) {

      checks.push(

        {
          pass:
            keywordAppears(
              title
            ),

          label:
            "Primary keyword appears in article title"
        },

        {
          pass:
            keywordAppears(
              slug.replace(
                /-/g,
                " "
              )
            ),

          label:
            "Primary keyword appears in URL slug"
        },

        {
          pass:
            keywordAppears(
              metaTitle
            ),

          label:
            "Primary keyword appears in meta title"
        },

        {
          pass:
            keywordAppears(
              metaDescription
            ),

          label:
            "Primary keyword appears in meta description"
        },

        {
          pass:
            keywordAppears(
              intro
            ),

          label:
            "Primary keyword appears near the beginning"
        },

        {
          pass:
            keywordAppears(
              headingText
            ),

          label:
            "Primary keyword appears in a subheading"
        }

      );

    }


    const passed =
      checks.filter(
        item =>
          item.pass
      ).length;


    const score =
      checks.length
        ? Math.round(
            passed /
            checks.length *
            100
          )
        : 0;


    const className =
      score >= 80
        ? "good"
        : score >= 55
          ? "medium"
          : "bad";


    section.innerHTML = `

      <div class="seo-assistant-head">

        <div>

          <span class="panel-kicker">
            SEO assistant
          </span>

          <h3>
            On-page checklist
          </h3>

        </div>

        <div class="seo-score ${className}">
          ${score}
        </div>

      </div>

      <div class="seo-checks">

        ${
          checks
            .map(
              item =>
                seoCheckHtml(
                  item.pass,
                  item.label
                )
            )
            .join("")
        }

      </div>

    `;
  }


  /* ==========================================
     FEATURED IMAGE PREVIEW
  ========================================== */

  function setupFeaturedImagePreview() {

    if (
      document.getElementById(
        "featured-preview"
      )
    ) {
      return;
    }


    const input =
      pf(
        "featured_image"
      );


    const field =
      input
        ?.closest(
          ".admin-field"
        );


    if (!field) return;


    const preview =
      document.createElement(
        "div"
      );


    preview.id =
      "featured-preview";

    preview.className =
      "featured-preview";


    field.appendChild(
      preview
    );


    input.addEventListener(
      "input",
      () => {

        markPostDirty();

        updateEditorUI();

      }
    );
  }


  function updateFeaturedPreview() {

    const preview =
      document.getElementById(
        "featured-preview"
      );


    if (!preview) return;


    const url =
      pf(
        "featured_image"
      )
        ?.value
        .trim();


    if (!url) {

      preview.classList
        .remove("show");

      preview.innerHTML =
        "";

      return;
    }


    preview.classList
      .add("show");


    preview.innerHTML = `

      <img
        src="${esc(url)}"
        alt="Featured image preview"
      >

    `;


    const image =
      preview.querySelector(
        "img"
      );


    image?.addEventListener(
      "error",
      () => {

        preview.innerHTML = `
          <div class="featured-preview-error">
            Image could not be loaded.
          </div>
        `;

      },
      {
        once:
          true
      }
    );
  }


  /* ==========================================
     FIELD COUNTERS
  ========================================== */

  function setupFieldCounters() {

    setupCounter(
      pf("meta_title"),
      45,
      60,
      "meta-title-counter"
    );


    setupCounter(
      pf(
        "meta_description"
      ),
      120,
      160,
      "meta-description-counter"
    );


    setupCounter(
      pf("excerpt"),
      60,
      220,
      "excerpt-counter"
    );


    [
      "primary_keyword",
      "status",
      "excerpt",
      "meta_title",
      "meta_description"
    ]
      .forEach(name => {

        const field =
          pf(name);


        field?.addEventListener(
          "input",
          () => {

            markPostDirty();

            updateEditorUI();

          }
        );


        field?.addEventListener(
          "change",
          () => {

            markPostDirty();

            updateEditorUI();

          }
        );

      });
  }


  function setupCounter(
    input,
    min,
    max,
    id
  ) {

    if (
      !input ||
      document.getElementById(
        id
      )
    ) {
      return;
    }


    const counter =
      document.createElement(
        "div"
      );


    counter.id =
      id;

    counter.className =
      "field-counter";


    input.insertAdjacentElement(
      "afterend",
      counter
    );


    counter.dataset.min =
      min;

    counter.dataset.max =
      max;
  }


  function updateCounter(
    input,
    id
  ) {

    const counter =
      document.getElementById(
        id
      );


    if (
      !input ||
      !counter
    ) {
      return;
    }


    const length =
      input.value.length;


    const min =
      Number(
        counter.dataset.min
      );


    const max =
      Number(
        counter.dataset.max
      );


    counter.className =
      "field-counter";


    if (
      length >= min &&
      length <= max
    ) {

      counter.classList
        .add("good");

    } else if (length) {

      counter.classList
        .add("warn");

    }


    counter.textContent =
      `${length} characters`;
  }


  /* ==========================================
     POST SEARCH + FILTER
  ========================================== */

  let postSearchInput =
    null;

  let postStatusFilter =
    null;


  function setupPostSearch() {

    const body =
      document.getElementById(
        "posts-body"
      );


    const tableWrap =
      body?.closest(
        ".admin-table-wrap"
      );


    if (
      !body ||
      !tableWrap ||
      document.getElementById(
        "admin-post-search"
      )
    ) {
      return;
    }


    const tools =
      document.createElement(
        "div"
      );


    tools.className =
      "posts-tools";


    tools.innerHTML = `

      <input
        type="search"
        id="admin-post-search"
        placeholder="Search title or slug..."
      >

      <select id="admin-post-filter">

        <option value="">
          All statuses
        </option>

        <option value="published">
          Published
        </option>

        <option value="draft">
          Draft
        </option>

      </select>

      <select id="admin-source-filter">

        <option value="">
          All sources
        </option>

        <option value="database">
          Database
        </option>

        <option value="static">
          Static
        </option>

      </select>

    `;


    tableWrap.insertAdjacentElement(
      "beforebegin",
      tools
    );


    postSearchInput =
      document.getElementById(
        "admin-post-search"
      );


    postStatusFilter =
      document.getElementById(
        "admin-post-filter"
      );


    const sourceFilter =
      document.getElementById(
        "admin-source-filter"
      );


    postSearchInput
      ?.addEventListener(
        "input",
        applyPostFilters
      );


    postStatusFilter
      ?.addEventListener(
        "change",
        applyPostFilters
      );


    sourceFilter
      ?.addEventListener(
        "change",
        applyPostFilters
      );
  }


  function applyPostFilters() {

    const body =
      document.getElementById(
        "posts-body"
      );


    if (!body) return;


    const search =
      document.getElementById(
        "admin-post-search"
      )
        ?.value
        .trim()
        .toLowerCase() ||
      "";


    const status =
      document.getElementById(
        "admin-post-filter"
      )
        ?.value ||
      "";


    const source =
      document.getElementById(
        "admin-source-filter"
      )
        ?.value ||
      "";


    body
      .querySelectorAll(
        "[data-post-row]"
      )
      .forEach(row => {

        const text =
          row.innerText
            .toLowerCase();


        const rowStatus =
          row.dataset
            .postStatus ||
          "";


        const rowSource =
          row.dataset
            .postSource ||
          "";


        const matchSearch =
          !search ||
          text.includes(search);


        const matchStatus =
          !status ||
          rowStatus === status;


        const matchSource =
          !source ||
          rowSource === source;


        row.style.display =
          matchSearch &&
          matchStatus &&
          matchSource
            ? ""
            : "none";

      });
  }


  /* ==========================================
     UNSAVED CHANGES
  ========================================== */

  function setupDirtyTracking() {

    postForm
      ?.addEventListener(
        "input",
        event => {

          if (
            event.target
              ?.matches(
                'input[type="file"]'
              )
          ) {
            return;
          }


          markPostDirty();

        }
      );


    window.addEventListener(
      "beforeunload",
      event => {

        if (!postDirty) {
          return;
        }


        event.preventDefault();

        event.returnValue =
          "";

      }
    );
  }


  function markPostDirty() {

    postDirty =
      true;


    const status =
      document.getElementById(
        "editor-live-status"
      );


    status?.classList
      .remove("saved");


    status?.classList
      .add("dirty");


    const label =
      status?.querySelector(
        "[data-editor-save-state]"
      );


    if (label) {

      label.textContent =
        "Unsaved";

    }
  }


  function markPostSaved() {

    postDirty =
      false;


    const status =
      document.getElementById(
        "editor-live-status"
      );


    status?.classList
      .remove("dirty");


    status?.classList
      .add("saved");


    const label =
      status?.querySelector(
        "[data-editor-save-state]"
      );


    if (label) {

      label.textContent =
        "Saved";

    }
  }


  /* ==========================================
     KEYBOARD SHORTCUTS
  ========================================== */

  function setupKeyboardShortcuts() {

    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Escape"
        ) {

          const modalCard =
            document.querySelector(
              "#post-modal .modal-card"
            );


          if (
            modalCard?.classList
              .contains(
                "post-editor-fullscreen"
              )
          ) {

            modalCard.classList
              .remove(
                "post-editor-fullscreen"
              );


            return;
          }

        }


        if (
          (
            event.ctrlKey ||
            event.metaKey
          ) &&
          event.key
            .toLowerCase() ===
            "s"
        ) {

          if (
            postModal?.classList
              .contains("open")
          ) {

            event.preventDefault();

            postForm
              ?.requestSubmit();

          }

        }

      }
    );
  }


  /* ==========================================
     UPDATE MODERN EDITOR UI
  ========================================== */

  function updateEditorUI() {

    if (
      !postForm ||
      !editor
    ) {
      return;
    }


    updateEditorStats();

    updateSerpPreview();

    updateSeoAssistant();

    updateFeaturedPreview();


    updateCounter(
      pf("meta_title"),
      "meta-title-counter"
    );


    updateCounter(
      pf(
        "meta_description"
      ),
      "meta-description-counter"
    );


    updateCounter(
      pf("excerpt"),
      "excerpt-counter"
    );


    if (!postDirty) {

      markPostSaved();

    }
  }


  /* ==========================================
     START
  ========================================== */

  boot()
    .catch(error => {

      show(
        error.message,
        "err"
      );


      setTimeout(
        () => {

          location.href =
            "/login/?next=/admin/";

        },
        1200
      );

    });

})();
