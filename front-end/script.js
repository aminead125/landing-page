
/*pour afficher le formulaire lorsque j'appuie sur le boutton Acheter maintenant ! */
document.addEventListener("DOMContentLoaded", function() {
    const buyButton = document.querySelector('.contact-card .contact-button');
    const formContainer = document.querySelector('.contact-card .form-container');
    
    buyButton.addEventListener('click', function() {
      formContainer.style.display = 'block';
    });
  });
  

  /*animation du paragraphe de la section 2 */document.addEventListener('DOMContentLoaded', function() {
  const paragraph = document.getElementById('collection-paragraph');
  const text = paragraph.textContent;
  // Découper en tokens (mots et espaces)
  const tokens = text.split(/(\s+)/);
  paragraph.innerHTML = ""; // Efface le contenu initial

  tokens.forEach((token, index) => {
    if (/^\s+$/.test(token)) {
      // Ajoute directement les espaces sans animation
      paragraph.appendChild(document.createTextNode(token));
    } else {
      const span = document.createElement("span");
      span.textContent = token;
      // Délai incrémental pour l'effet de vague (exemple : 0.1s entre chaque mot)
      span.style.animationDelay = `${index * 0.1}s`;
      span.classList.add("wave-word");
      paragraph.appendChild(span);
    }
  });


  // Sélectionner la section "collection"
  const collectionSection = document.getElementById('collection');

  // Créer un observer pour détecter l'entrée de la section dans le viewport
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Lorsque la section est atteinte, on réinitialise l'animation de chaque mot
        const spans = paragraph.querySelectorAll('span.wave-word');
        spans.forEach(span => {
          span.classList.remove('wave-word');
          // Forcer un reflow pour que la suppression prenne effet
          void span.offsetWidth;
          span.classList.add('wave-word');
        });
      }
    });
  }, { threshold: 0.5 }); // Ajuste le seuil selon tes besoins

  observer.observe(collectionSection);
});

document.addEventListener('DOMContentLoaded', function(){
  const hamburger = document.querySelector('.hamburger');
  const sidebar = document.getElementById('sidebar');
  const closeBtn = document.querySelector('.close-btn');

  // Ouvrir la sidebar lors du clic sur le hamburger
  hamburger.addEventListener('click', function(){
    sidebar.classList.add('active');
  });

  // Fermer la sidebar lors du clic sur le bouton de fermeture
  closeBtn.addEventListener('click', function(){
    sidebar.classList.remove('active');
  });

  // Optionnel : fermer la sidebar lors du clic sur un lien
  const sidebarLinks = document.querySelectorAll('.sidebar-links li a');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', function(){
      sidebar.classList.remove('active');
    });
  });
});
