import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const interviewId = 'b8d86566-9001-4e69-9a7b-20d38447843e';

async function main() {
  // Get interview with key_takeaways
  const { data: interview } = await supabase
    .from('interviews')
    .select('id, title, key_takeaways')
    .eq('id', interviewId)
    .single();

  console.log('\n📄 Interview:', interview?.title);
  console.log('\n💡 Key Takeaways:');
  if (interview?.key_takeaways) {
    console.log(interview.key_takeaways);
  } else {
    console.log('⚠️  NOT GENERATED');
  }

  // Get latest sales lens summary
  const { data: summaries } = await supabase
    .from('sales_lens_summaries')
    .select('id, framework, computed_at')
    .eq('interview_id', interviewId)
    .order('computed_at', { ascending: false })
    .limit(1);

  if (summaries && summaries.length > 0) {
    const summary = summaries[0];
    console.log('\n📊 Latest Sales Lens Summary:');
    console.log('  Framework:', summary.framework);
    console.log('  Generated:', summary.computed_at);

    // Get slots including next steps
    const { data: slots } = await supabase
      .from('sales_lens_slots')
      .select('slot, label, description, text_value, date_value, status, confidence')
      .eq('summary_id', summary.id)
      .order('position', { ascending: true });

    const nextSteps = slots?.filter(s => s.slot.startsWith('next_step')) || [];
    const otherSlots = slots?.filter(s => !s.slot.startsWith('next_step')) || [];

    console.log('\n  Regular slots:', otherSlots.length);
    otherSlots.forEach(slot => {
      console.log('    -', slot.slot, ':', slot.label);
    });

    console.log('\n  📋 Next Steps:', nextSteps.length);
    nextSteps.forEach((step, idx) => {
      console.log(`    ${idx + 1}. ${step.label || '(no label)'}`);
      console.log(`       Action: ${step.description || '(no description)'}`);
      console.log(`       Owner: ${step.text_value || '(no owner)'}`);
      console.log(`       Due: ${step.date_value || '(no date)'}`);
      console.log(`       Status: ${step.status || '(no status)'}`);
      console.log(`       Confidence: ${step.confidence || 0}`);
    });
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
