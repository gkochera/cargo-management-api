function copyToClipboard() {
    var jwt = document.getElementById("jwt").innerText;
    var hidden = document.createElement("input");
    hidden.setAttribute("value", jwt);
    document.body.appendChild(hidden);
    hidden.select();
    document.execCommand("copy");
    document.body.removeChild(hidden);

    var message = document.getElementById("notice")
    message.style.display = 'block';
}   

document.querySelector("#jwt-copy").addEventListener("click", copyToClipboard);