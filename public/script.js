async function uploadImage() {
  const input = document.getElementById('imageInput');
  if (!input.files.length) {
    alert("Selecciona una imagen");
    return;
  }

  const formData = new FormData();
  formData.append("image", input.files[0]);

  const response = await fetch('/analyze', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  const resultDiv = document.getElementById('result');

  if (result.error) {
    resultDiv.innerText = `Error: ${result.error}`;
  } else {
    resultDiv.innerHTML = "<h2>Etiquetas:</h2><ul>" +
      result.tags.map(tag => `<li>${tag.tag} (${tag.confidence}%)</li>`).join("") +
      "</ul>";
  }
}
