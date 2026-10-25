// Service-area towns: the ONE list to edit. Everything on the page (town
// dropdown, pricing chips, travel-fee sentence, FAQ answer, hero and footer
// town lists, order total) is generated from this array.
//   fee        flat dollars added to the $90 base price (0 = no travel fee)
//   comingSoon optional label; the town shows but can't be picked yet
//   note       optional; used for the "Other — text us" catch-all
window.TOWNS = [
  { name: "Estero", fee: 0 },
  { name: "Bonita Springs", fee: 0 },
  { name: "Fort Myers", fee: 0 },
  { name: "San Carlos Park", fee: 0 },
  { name: "Three Oaks", fee: 0 },
  { name: "Gateway", fee: 0 },
  { name: "Lehigh Acres", fee: 15 },
  { name: "Naples", fee: 20 },
  { name: "Fort Myers Beach", fee: 20 },
  { name: "Cape Coral", fee: 0, comingSoon: "Coming December" },
  { name: "Other — text us", fee: 0, note: "Somewhere else? We'll confirm by text." }
];
