(function ($) {
    let functionUrlPresign = localStorage.getItem("functionUrlPresign");
    if (functionUrlPresign) {
        $("#functionUrlPresign").val(functionUrlPresign);
    }

    let functionUrlList = localStorage.getItem("functionUrlList");
    if (functionUrlList) {
        console.log("function url list is", functionUrlList);
        $("#functionUrlList").val(functionUrlList);
    }

    let imageItemTemplate = Handlebars.compile($("#image-item-template").html());

    const injectHostnameInUrl = (url, urlWithHost) => {
        if (url.match(/https?:\/\/[\d.]+(:\d+)?\/.*/)) {
            const parsedUrl = new URL(url);
            const parsedUrlWithHost = new URL(urlWithHost);
            parsedUrl.hostname = parsedUrlWithHost.hostname;
            parsedUrl.protocol = parsedUrlWithHost.protocol;
            url = parsedUrl.href;
        }
        return url;
    };

    $("#configForm").submit(function (event) {
        if (event.preventDefault)
            event.preventDefault();
        else
            event.returnValue = false;

        event.preventDefault();

        let action = $(this).find("button[type=submit]:focus").attr('name');

        if (action == "save") {
            localStorage.setItem("functionUrlPresign", $("#functionUrlPresign").val());
            localStorage.setItem("functionUrlList", $("#functionUrlList").val());
            alert("Configuration saved");
        } else if (action == "clear") {
            localStorage.removeItem("functionUrlPresign");
            localStorage.removeItem("functionUrlList");
            $("#functionUrlPresign").val("")
            $("#functionUrlList").val("")
            alert("Configuration cleared");
        } else {
            alert("Unknown action");
        }

    });

    $("#uploadForm").submit(function (event) {
        $("#uploadForm button").addClass('disabled');

        if (event.preventDefault)
            event.preventDefault();
        else
            event.returnValue = false;

        event.preventDefault();

        let fileName = $("#customFile").val().replace(/C:\\fakepath\\/i, '');
        let functionUrlPresign = $("#functionUrlPresign").val();

        // modify the original form
        console.log(fileName, functionUrlPresign);

        let urlToCall = functionUrlPresign + "/" + fileName
        console.log(urlToCall);

        let form = this;

        $.ajax({
            url: urlToCall,
            success: function (data) {
                console.log("got pre-signed POST URL", data);
                if (!data.fields) {
                    data = JSON.parse(data);
                }

                // set form fields to make it easier to serialize
                let fields = data.fields;
                $(form).attr("action", data.url);
                for (let key in fields) {
                    $("#" + key).val(fields[key]);
                }

                let formData = new FormData($("#uploadForm")[0]);
                console.log("sending form data", formData);

                // make sure we have the right hostname in the presigned URL
                let url = injectHostnameInUrl(data.url, functionUrlPresign);

                $.ajax({
                    type: "POST",
                    url,
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: function () {
                        alert("success!");
                        updateImageList();
                    },
                    error: function () {
                        alert("error! check the logs");
                    },
                    complete: function (event) {
                        console.log("done", event);
                        $("#uploadForm button").removeClass('disabled');
                    }
                });
            },
            error: function (e) {
                console.log("error", e);
                alert("error getting pre-signed URL. check the logs!");
                $("#uploadForm button").removeClass('disabled');
            }
        });
    });

    function updateImageList() {
        let listUrl = $("#functionUrlList").val();
        if (!listUrl) {
            alert("Please set the function URL of the list Lambda");
            return
        }
        if (!listUrl.endsWith("/")) {
            listUrl += "/";
        }

        $.ajax({
            url: listUrl,
            success: function (response) {
                $('#imagesContainer').empty(); // Empty imagesContainer
                response = response || [];
                if (!Array.isArray(response)) {
                    response = JSON.parse(response);
                }
                response.forEach(function (item) {
                    console.log(item);
                    const functionUrlPresign = $("#functionUrlPresign").val();
                    if (item.Original && item.Original.URL) {
                        item.Original.URL = injectHostnameInUrl(item.Original.URL, functionUrlPresign);
                    }
                    if (item.Resized && item.Resized.URL) {
                        item.Resized.URL = injectHostnameInUrl(item.Resized.URL, functionUrlPresign);
                    }
                    let cardHtml = imageItemTemplate(item);
                    $("#imagesContainer").append(cardHtml);
                });
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log("Error:", textStatus, errorThrown);
                alert("error! check the logs");
            }
        });
    }

    $("#updateImageListButton").click(function (event) {
        updateImageList();
    });

    if (functionUrlList) {
        updateImageList();
    }

})(jQuery);
