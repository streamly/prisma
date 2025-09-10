const cookies = Object.fromEntries(
    document.cookie.split('; ').map(c => c.split('='))
);

// Set year in footer
document.getElementById("year").textContent = new Date().getFullYear();

// Add company functionality
$(document).ready(function () {
    // Add new company input
    $('#add-company').click(function () {
        const newInput = $('#company-wrapper .company-input:first').clone();
        newInput.find('input').val(''); // clear value
        $('#company-wrapper').append(newInput);
        updateRemoveButtons();
    });

    // Remove company input
    $('#company-wrapper').on('click', '.remove-company', function () {
        if ($('#company-wrapper .company-input').length > 1) {
            $(this).closest('.company-input').remove();
        }
        updateRemoveButtons();
    });

    // Show/hide remove buttons if only 1 input left
    function updateRemoveButtons() {
        if ($('#company-wrapper .company-input').length === 1) {
            $('#company-wrapper .company-input .remove-company').hide();
        } else {
            $('#company-wrapper .company-input .remove-company').show();
        }
    }

    updateRemoveButtons();
});

// Edit video modal
$(document).on("click", ".edit", function () {
    const data = $(this).closest('.row').data();
    $("#vodModal .modal-video-title").text(decodeURIComponent(data.title));

    $.each(data, function (key, value) {
        $("#" + key).val(decodeURIComponent(value));
    });
    const modal = new mdb.Modal(document.getElementById("vodModal"));
    modal.show();
});

// Performance toggle
$(document).on("click", "#performance", function () {
    $(".performance").toggle();
});

// Update video
$('#vod').parsley();
$("#publish").on("click", async function () {
    // Collect values
    const payload = {
        id: $("#id").val(),
        title: $("#title").val(),
        description: $("#description").val(),
        category: $("#category").val(),
        company: $("#company").val(),
        tags: $("#tags").val().split(','),
        cpv: parseFloat($("#cpv").val()),
        budget: parseFloat($("#budget").val()),
        active: 1
    };

    try {
        const response = await fetch("/api/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log(result);

        if (result.success) {
            alert("Update successful");
            $(".btn-close").trigger('click');
        } else {
            alert("Error: " + result.error);
        }
    } catch (err) {
        alert("Request failed: " + err.message);
    }
});

// Delete video
$(document).on("click", ".trash", async function (e) {
    e.preventDefault();

    const payload = {
        id: $("#id").val(),
    };

    try {
        const response = await fetch("/api/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log(result);

        if (result.success) {
            alert("Delete successful");
            $(".btn-close").trigger("click");
        } else {
            alert("Error: " + result.error);
        }
    } catch (err) {
        alert("Request failed: " + err.message);
    }
});

// Analytics modal
$(document).on("click", ".analytics", function () {
    const modal = new mdb.Modal(document.getElementById("analyticsModal"));
    modal.show();
});

// Conversions modal
$(document).on("click", ".conversions", function () {
    const modal = new mdb.Modal(document.getElementById("conversionsModal"));
    modal.show();
});

// Billing modal
$(document).on("click", ".billing", function () {
    const modal = new mdb.Modal(document.getElementById("billingModal"));
    modal.show();
});

// Help modal
$(document).on("click", ".help", function () {
    const modal = new mdb.Modal(document.getElementById("helpModal"));
    modal.show();
});

// Add video (plus button) - redirect to upload page
$(document).on("click", ".add", function () {
    window.location.href = '/dev/upload/';
});

// Sign out functionality
$(document).on("click", ".logout", async function () {
    try {
        await Clerk.signOut();
        window.location.href = '/dev/auth/';
    } catch (error) {
        console.error('Sign out error:', error);
        // Fallback redirect even if sign out fails
        window.location.href = '/dev/auth/';
    }
});

// Video.js player
const player = videojs('player', {
    autoplay: true,
    muted: false,
    controls: true,
});

// Modal close handler
$("#vodModal").on("hidden.bs.modal", function () {
    player.pause();
    $('.modal.show .btn-close, .offcanvas.show .btn-close').trigger('click');
    $(document).attr("title", "SyndiNet");

    const uploaded = $(this).data('uploaded');
    if (uploaded) {
        $(this).removeData('uploaded');
        location.href = location.pathname;
    }
});

// Duration formatter
function duration(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const formattedMins = mins < 10 ? "0" + mins : mins;
    const formattedSecs = secs < 10 ? "0" + secs : secs;

    if (hrs > 0) {
        return `${hrs}:${formattedMins}:${formattedSecs}`;
    } else {
        return `${formattedMins}:${formattedSecs}`;
    }
}

function decodeHTMLEntities(text) {
    const txt = document.createElement("textarea");
    txt.innerHTML = text;
    return txt.value;
}

// Get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Check authentication and get API key
async function initializeSearch() {
    try {
        // Wait for Clerk to load
        await Clerk.load();

        // Check if user is signed in
        if (!Clerk.session) {
            console.log('User not signed in, redirecting to sign-in...');
            Clerk.redirectToSignIn({ redirectUrl: '/dev/auth' });
            return;
        }

        // Get API key from cookie
        const apiKey = getCookie('apikey');
        if (!apiKey) {
            console.log('No API key found, redirecting to sign-in...');
            Clerk.redirectToSignIn({ redirectUrl: '/dev/auth' });
            return;
        }

        // Date calculations
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
        const yesterday = today - 86400;
        const startOfWeek = today - (now.getDay() * 86400);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;

        // Initialize Typesense InstantSearch with cookie API key
        const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
            server: {
                apiKey: apiKey,
                nodes: [{ host: "t1.tubie.cx", port: 443, protocol: "https" }],
            },
            additionalSearchParameters: {
                query_by: "title,company,channel,description,tags",
            },
        });

        return { typesenseInstantsearchAdapter, today, yesterday, startOfWeek, startOfMonth };
    } catch (error) {
        console.error('Search initialization error:', error);
        Clerk.redirectToSignIn({ redirectUrl: '/dev/auth' });
    }
}

// Initialize search when page loads
async function startSearch() {
    const searchConfig = await initializeSearch();
    if (!searchConfig) return; // Auth failed, already redirected

    const { typesenseInstantsearchAdapter, today, yesterday, startOfWeek, startOfMonth } = searchConfig;

    const search = instantsearch({
        indexName: "videos",
        searchClient: typesenseInstantsearchAdapter.searchClient,
        routing: false,
        searchFunction(helper) {
            if (helper.state.page === 0) {
                window.scrollTo({ top: 0, behavior: 'auto', });
            }
            helper.search();
        },
    });

    // Add search widgets
    search.addWidgets([
        instantsearch.widgets.searchBox({
            container: "#searchbox",
            placeholder: "Search",
            autofocus: true,
            showReset: true,
            showSubmit: true,
        }),

        instantsearch.widgets.refinementList({
            container: '#channel-filter',
            attribute: 'channel',
            searchable: true,
            searchablePlaceholder: 'Search companies',
            limit: 30,
            templates: {
                item(data) {
                    return `<label><input type="checkbox" ${data.isRefined ? 'checked' : ''} /> ${decodeHTMLEntities(data.label)} (${data.count})</label>`;
                }
            }
        }),

        instantsearch.widgets.numericMenu({
            container: '#duration-filter',
            attribute: 'duration',
            items: [
                { label: 'Any' },
                { label: 'Under 4 minutes', start: 1, end: 239 },
                { label: '4 - 20 minutes', start: 240, end: 1199 },
                { label: 'Over 20 minutes', start: 1200 },
            ],
        }),

        instantsearch.widgets.numericMenu({
            container: '#created-filter',
            attribute: 'created',
            items: [
                { label: 'All', start: 0 },
                { label: 'Today', start: today },
                { label: 'Yesterday', start: yesterday, end: today },
                { label: 'This Week', start: startOfWeek },
                { label: 'This Month', start: startOfMonth },
            ],
        }),

        instantsearch.widgets.currentRefinements({
            container: '#refinements',
            transformItems(items) {
                if (items.length > 0) {
                    $("#clear").show();
                } else {
                    $("#clear").hide();
                }
                return items;
            }
        }),

        instantsearch.widgets.infiniteHits({
            container: "#hits",
            transformItems(items) {
                return items.map((item, index) => ({
                    ...item,
                    resultPosition: index + 1,
                }));
            },
            templates: {
                item(hit) {
                    hit.position = hit.__position;

                    const dataAttributes = Object.keys(hit).map(key => {
                        const safeKey = `data-${key.replace(/[^a-z0-9_-]/gi, '')}`;
                        let value = hit[key];
                        if (Array.isArray(value)) value = value.join('; ');
                        const safeValue = encodeURIComponent(String(value ?? ''));
                        return `${safeKey}="${safeValue}"`;
                    }).join(' ');

                    const title = decodeHTMLEntities(hit.title || "");
                    const description = decodeHTMLEntities(hit.description || "");

                    return `
<div class="row border-0 bg-transparent mb-3" ${dataAttributes} type="button" id="${hit.id}">
  <!-- Thumbnail (col-2) -->
  <div class="col-2 text-end">
    <div class="edit pointer thumbnail-container bg-dark" alt="${title}" title="${title}">
      <div class="img-fluid border bg-dark thumbnail-background"
           style="background-image:url('/images/${hit.id}.jpg');
                  height:69px; width:123px;
                  background-repeat:no-repeat;
                  background-size:cover;">
      </div>
      <div class="duration">${duration(hit.duration)}</div>
    </div>
  </div>

  <!-- Title + Channel (col) -->
  <div class="col">
    <h6 class="edit title-clamp m-0" title="${title}">${title}</h6>
    <div class="edit pointer text-muted small text-truncate"> 
      ${Array.isArray(hit.channel) ? hit.channel.join("; ") : ""}
    </div>
  </div>
  
  <div class="col-1">
    <div class="dropdown">
      <a class="btn btn-link bg-transparent p-0 m-0" href="#" title="More" data-mdb-toggle="dropdown" aria-expanded="false">
        <i class="bx bx-dots-vertical-rounded bx-sm mx-4"></i>
      </a>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><a type="button" class="dropdown-item edit">Edit</a></li>
        <li><a type="button" class="dropdown-item analytics">Analytics</a></li>    
        <li><a type="button" class="dropdown-item conversions">Conversions</a></li> 
        <li><a type="button" class="dropdown-item billing">Billing</a></li> 
        <li><a type="button" class="dropdown-item trash">Trash</a></li>              
      </ul>
    </div>  
  </div>
</div>`;
                },
            },
        }),
    ]);

    // Start search
    search.start();

    return search;
}

// Initialize search when DOM is ready
$(document).ready(async function () {
    const search = await startSearch();

    // Handle URL parameters after search is initialized
    if (search) {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get('v')) {
            const v = urlParams.get('v');
            search.helper
                .setQuery("")
                .setQueryParameter("filters", `id:${v}`)
                .search();
        }
    }

    setTimeout(function () {
        $("#vodModal").data("uploaded", 1);
        $(".edit").first().trigger("click");
    }, 1000);
});

// Reload functionality
$(document).on("click", "#reload", async function (e) {
    const search = await startSearch();
    if (search) {
        search.helper.setQuery("").search();
    }
});

// Auto-trigger load more when visible
const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                const btn = entry.target;
                if (!btn.disabled && btn.offsetParent !== null) {
                    btn.click();
                }
            }
        });
    },
    { threshold: [0.5] }
);

const watchLoadMoreButton = () => {
    const btn = document.querySelector(".ais-InfiniteHits-loadMore");
    if (btn) {
        observer.observe(btn);
    } else {
        setTimeout(watchLoadMoreButton, 300);
    }
};
watchLoadMoreButton();
