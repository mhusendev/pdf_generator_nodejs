window.onload = function() {

    if(!sessionStorage.getItem('token')) {
        window.location.href ="./index.html"
    }
};