import type { Messages } from "./en";

/** French (written to work for both France and Quebec). Must have exactly the shape of en.ts. */
export const fr: Messages = {
  meta: {
    title: "Un message vidéo personnalisé du père Noël | MyVideoFromSanta",
    description: "Le père Noël dit le prénom de votre enfant dans un message vidéo chaleureux. Prêt en quelques instants, dès 5,99 $.",
  },
  nav: { brand: "MyVideoFromSanta", switchLanguage: "English" },
  hero: {
    eyebrow: "Tout droit du pôle Nord",
    title: "Le père Noël dit le prénom de votre enfant.",
    subtitle: "Un message vidéo chaleureux et personnel du père Noël, prêt en quelques instants. Regardez ses yeux briller.",
    sampleCaption: "Vidéo d’exemple",
  },
  form: {
    nameLabel: "Le prénom de votre enfant",
    namePlaceholder: "p. ex. Emma",
    nameHelp: "Le prénom seulement. Nous ne demandons jamais de nom de famille, d’école ni d’adresse.",
    languageLabel: "Le père Noël parle",
    languageEn: "Anglais (English)",
    languageFrSoon: "Français (bientôt)",
    consent: "Je suis le parent ou le tuteur de cet enfant, ou j’ai sa permission.",
    submit: "Voir l’aperçu",
    submitting: "Le père Noël se prépare…",
    errors: {
      empty: "Veuillez écrire le prénom de votre enfant.",
      tooLong: "Ce prénom est un peu long pour le père Noël. Utilisez 20 lettres au maximum.",
      invalidCharacters: "Utilisez seulement des lettres (les accents, traits d’union et apostrophes sont acceptés).",
      blocked: "Le père Noël ne peut pas dire ce mot. Veuillez écrire le prénom de votre enfant.",
      consent: "Veuillez confirmer que vous êtes le parent ou le tuteur, ou que vous avez sa permission.",
      generic: "Une erreur s’est produite. Veuillez réessayer.",
      rateLimited: "Trop d’essais. Patientez une minute et réessayez.",
    },
  },
  steps: {
    title: "Comment ça marche",
    one: { title: "Écrivez son prénom", body: "Seulement le prénom. Rien d’autre sur votre enfant." },
    two: { title: "Voyez l’aperçu", body: "Découvrez comment le père Noël le saluera avant de payer." },
    three: { title: "Regardez ensemble", body: "La vidéo joue tout de suite sur une page privée. Téléchargez-la ou partagez-la avec la famille." },
  },
  faq: {
    title: "Les questions des parents",
    items: [
      {
        q: "Est-ce vraiment personnalisé?",
        a: "Oui. Le père Noël dit le prénom de votre enfant à voix haute, et il apparaît sur la carte de la liste des enfants sages à la fin. Chaque vidéo est faite pour le prénom que vous écrivez.",
      },
      {
        q: "Les données de mon enfant sont-elles protégées?",
        a: "Nous demandons seulement un prénom. Il n’apparaît jamais dans les liens ni dans les statistiques, et nous le supprimons après la saison. Votre vidéo est sur une page privée que seules les personnes ayant le lien peuvent ouvrir.",
      },
      {
        q: "Quand vais-je la recevoir?",
        a: "La plupart des prénoms sont prêts quelques instants après le paiement. Pour les prénoms rares, les lutins ont besoin de quelques minutes de plus; nous vous écrivons dès que c’est prêt.",
      },
    ],
  },
  preview: {
    title: "Voici comment le père Noël saluera {name}",
    watermark: "APERÇU",
    body: "La vidéo complète dure environ 45 secondes : le père Noël lève les yeux de sa lettre, salue {name} par son prénom et le trouve sur la liste des enfants sages.",
    pay: "Obtenir la vidéo complète · {price}",
    paying: "Ouverture du paiement sécurisé…",
    secure: "Paiement sécurisé avec Stripe. Vous recevrez aussi le lien par courriel.",
    changeName: "Changer le prénom",
    expired: "Cet aperçu a expiré. Veuillez recommencer.",
  },
  checkout: {
    productName: "Message vidéo personnalisé du père Noël",
  },
  watch: {
    title: "Un message du père Noël",
    confirming: "Confirmation du paiement…",
    rendering: "Les lutins emballent votre vidéo…",
    renderingBody: "Pour un nouveau prénom, cela prend habituellement une minute ou deux. Gardez cette page ouverte, ou revenez avec le lien reçu par courriel.",
    ready: "Votre vidéo du père Noël",
    download: "Télécharger la vidéo",
    share: "Copier le lien",
    copied: "Lien copié!",
    failed: "Le traîneau du père Noël a eu un pépin avec cette vidéo. Nous avons été avertis et vous écrirons dès que ce sera réglé.",
    notFound: "Nous n’avons pas trouvé cette vidéo. Vérifiez le lien dans votre courriel.",
    privateNote: "Cette page est privée. Toute personne ayant le lien peut la regarder : partagez-le seulement avec la famille.",
    upsellTitle: "Rendez-la encore plus spéciale",
    upsellBody: "Le père Noël parle du moment dont {name} est le plus fier, de son souhait et plus encore. Bientôt offert.",
  },
  footer: {
    privacy: "Confidentialité",
    terms: "Conditions",
    refunds: "Remboursements",
    copyright: "© {year} MyVideoFromSanta. Un message vidéo généré par IA.",
  },
  email: {
    videoReady: {
      subject: "Votre vidéo du père Noël est prête",
      heading: "Ho ho ho! Votre vidéo est prête.",
      body: "Le père Noël a enregistré un message juste pour {name}. Regardez-le ici :",
      button: "Regarder la vidéo",
      privacy: "Ce lien est privé. Vous pouvez supprimer vos données en tout temps :",
      deleteLink: "Supprimer mes données",
    },
  },
  santa: {
    greeting: "Bonjour, {name}!",
    endCardTitle: "Joyeux Noël, {name}!",
    endCardTitleGeneric: "Joyeux Noël!",
    endCardSignature: "Je t’embrasse, le père Noël",
  },
};
