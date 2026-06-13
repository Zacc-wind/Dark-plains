const SPELL_ICON_PATHS: Record<string, string> = {
  'arcane-bolt': '/assets/spells/arcane-bolt.png',
  'sanctified-mend': '/assets/spells/sanctified-mend.png',
  'thorn-ward': '/assets/spells/warding-prayer.png',
  'withering-curse': '/assets/spells/withering-curse.png',
  'rallying-hymn': '/assets/spells/rallying-hymn.png',
  'chain-spark': '/assets/spells/chain-spark.png',
  'gravity-snare': '/assets/spells/gravity-snare.png',
  'ember-dart': '/assets/spells/ember-dart.png',
  'warding-prayer': '/assets/spells/warding-prayer.png',
  'ashen-step': '/assets/spells/ashen-step.png',
  judgement: '/assets/spells/judgement.png',
  'royal-command': '/assets/spells/royal-command.png',
  'moonlit-veil': '/assets/spells/moonlit-veil.png',
  'blood-star': '/assets/spells/blood-star.png',
  'iron-benediction': '/assets/spells/iron-benediction.png',
  'soul-tether': '/assets/spells/soul-tether.png',
  'frost-lance': '/assets/spells/frost-lance.png',
  'eclipse-nova': '/assets/spells/eclipse-nova.png',
  'saint-king-aegis': '/assets/spells/saint-king-aegis.png',
  'time-crown-edict': '/assets/spells/time-crown-edict.png',
};

export function getSpellIconPath(spell: { id: string }): string {
  return SPELL_ICON_PATHS[spell.id] || '/assets/icons/magic.png';
}
