create extension if not exists "pg_net" with schema "public" version '0.14.0';

drop policy "insights_read_only" on "public"."insights";

revoke delete on table "public"."account_settings" from "anon";

revoke insert on table "public"."account_settings" from "anon";

revoke references on table "public"."account_settings" from "anon";

revoke select on table "public"."account_settings" from "anon";

revoke trigger on table "public"."account_settings" from "anon";

revoke truncate on table "public"."account_settings" from "anon";

revoke update on table "public"."account_settings" from "anon";

revoke delete on table "public"."account_settings" from "authenticated";

revoke insert on table "public"."account_settings" from "authenticated";

revoke references on table "public"."account_settings" from "authenticated";

revoke select on table "public"."account_settings" from "authenticated";

revoke trigger on table "public"."account_settings" from "authenticated";

revoke truncate on table "public"."account_settings" from "authenticated";

revoke update on table "public"."account_settings" from "authenticated";

revoke delete on table "public"."account_settings" from "service_role";

revoke insert on table "public"."account_settings" from "service_role";

revoke references on table "public"."account_settings" from "service_role";

revoke select on table "public"."account_settings" from "service_role";

revoke trigger on table "public"."account_settings" from "service_role";

revoke truncate on table "public"."account_settings" from "service_role";

revoke update on table "public"."account_settings" from "service_role";

revoke delete on table "public"."actions" from "anon";

revoke insert on table "public"."actions" from "anon";

revoke references on table "public"."actions" from "anon";

revoke select on table "public"."actions" from "anon";

revoke trigger on table "public"."actions" from "anon";

revoke truncate on table "public"."actions" from "anon";

revoke update on table "public"."actions" from "anon";

revoke delete on table "public"."actions" from "authenticated";

revoke insert on table "public"."actions" from "authenticated";

revoke references on table "public"."actions" from "authenticated";

revoke select on table "public"."actions" from "authenticated";

revoke trigger on table "public"."actions" from "authenticated";

revoke truncate on table "public"."actions" from "authenticated";

revoke update on table "public"."actions" from "authenticated";

revoke delete on table "public"."actions" from "service_role";

revoke insert on table "public"."actions" from "service_role";

revoke references on table "public"."actions" from "service_role";

revoke select on table "public"."actions" from "service_role";

revoke trigger on table "public"."actions" from "service_role";

revoke truncate on table "public"."actions" from "service_role";

revoke update on table "public"."actions" from "service_role";

revoke delete on table "public"."analysis_jobs" from "anon";

revoke insert on table "public"."analysis_jobs" from "anon";

revoke references on table "public"."analysis_jobs" from "anon";

revoke select on table "public"."analysis_jobs" from "anon";

revoke trigger on table "public"."analysis_jobs" from "anon";

revoke truncate on table "public"."analysis_jobs" from "anon";

revoke update on table "public"."analysis_jobs" from "anon";

revoke delete on table "public"."analysis_jobs" from "authenticated";

revoke insert on table "public"."analysis_jobs" from "authenticated";

revoke references on table "public"."analysis_jobs" from "authenticated";

revoke select on table "public"."analysis_jobs" from "authenticated";

revoke trigger on table "public"."analysis_jobs" from "authenticated";

revoke truncate on table "public"."analysis_jobs" from "authenticated";

revoke update on table "public"."analysis_jobs" from "authenticated";

revoke delete on table "public"."analysis_jobs" from "service_role";

revoke insert on table "public"."analysis_jobs" from "service_role";

revoke references on table "public"."analysis_jobs" from "service_role";

revoke select on table "public"."analysis_jobs" from "service_role";

revoke trigger on table "public"."analysis_jobs" from "service_role";

revoke truncate on table "public"."analysis_jobs" from "service_role";

revoke update on table "public"."analysis_jobs" from "service_role";

revoke delete on table "public"."annotations" from "anon";

revoke insert on table "public"."annotations" from "anon";

revoke references on table "public"."annotations" from "anon";

revoke select on table "public"."annotations" from "anon";

revoke trigger on table "public"."annotations" from "anon";

revoke truncate on table "public"."annotations" from "anon";

revoke update on table "public"."annotations" from "anon";

revoke delete on table "public"."annotations" from "authenticated";

revoke insert on table "public"."annotations" from "authenticated";

revoke references on table "public"."annotations" from "authenticated";

revoke select on table "public"."annotations" from "authenticated";

revoke trigger on table "public"."annotations" from "authenticated";

revoke truncate on table "public"."annotations" from "authenticated";

revoke update on table "public"."annotations" from "authenticated";

revoke delete on table "public"."annotations" from "service_role";

revoke insert on table "public"."annotations" from "service_role";

revoke references on table "public"."annotations" from "service_role";

revoke select on table "public"."annotations" from "service_role";

revoke trigger on table "public"."annotations" from "service_role";

revoke truncate on table "public"."annotations" from "service_role";

revoke update on table "public"."annotations" from "service_role";

revoke delete on table "public"."comments" from "anon";

revoke insert on table "public"."comments" from "anon";

revoke references on table "public"."comments" from "anon";

revoke select on table "public"."comments" from "anon";

revoke trigger on table "public"."comments" from "anon";

revoke truncate on table "public"."comments" from "anon";

revoke update on table "public"."comments" from "anon";

revoke delete on table "public"."comments" from "authenticated";

revoke insert on table "public"."comments" from "authenticated";

revoke references on table "public"."comments" from "authenticated";

revoke select on table "public"."comments" from "authenticated";

revoke trigger on table "public"."comments" from "authenticated";

revoke truncate on table "public"."comments" from "authenticated";

revoke update on table "public"."comments" from "authenticated";

revoke delete on table "public"."comments" from "service_role";

revoke insert on table "public"."comments" from "service_role";

revoke references on table "public"."comments" from "service_role";

revoke select on table "public"."comments" from "service_role";

revoke trigger on table "public"."comments" from "service_role";

revoke truncate on table "public"."comments" from "service_role";

revoke update on table "public"."comments" from "service_role";

revoke delete on table "public"."decision_question_metrics" from "anon";

revoke insert on table "public"."decision_question_metrics" from "anon";

revoke references on table "public"."decision_question_metrics" from "anon";

revoke select on table "public"."decision_question_metrics" from "anon";

revoke trigger on table "public"."decision_question_metrics" from "anon";

revoke truncate on table "public"."decision_question_metrics" from "anon";

revoke update on table "public"."decision_question_metrics" from "anon";

revoke delete on table "public"."decision_question_metrics" from "authenticated";

revoke insert on table "public"."decision_question_metrics" from "authenticated";

revoke references on table "public"."decision_question_metrics" from "authenticated";

revoke select on table "public"."decision_question_metrics" from "authenticated";

revoke trigger on table "public"."decision_question_metrics" from "authenticated";

revoke truncate on table "public"."decision_question_metrics" from "authenticated";

revoke update on table "public"."decision_question_metrics" from "authenticated";

revoke delete on table "public"."decision_question_metrics" from "service_role";

revoke insert on table "public"."decision_question_metrics" from "service_role";

revoke references on table "public"."decision_question_metrics" from "service_role";

revoke select on table "public"."decision_question_metrics" from "service_role";

revoke trigger on table "public"."decision_question_metrics" from "service_role";

revoke truncate on table "public"."decision_question_metrics" from "service_role";

revoke update on table "public"."decision_question_metrics" from "service_role";

revoke delete on table "public"."decision_question_risks" from "anon";

revoke insert on table "public"."decision_question_risks" from "anon";

revoke references on table "public"."decision_question_risks" from "anon";

revoke select on table "public"."decision_question_risks" from "anon";

revoke trigger on table "public"."decision_question_risks" from "anon";

revoke truncate on table "public"."decision_question_risks" from "anon";

revoke update on table "public"."decision_question_risks" from "anon";

revoke delete on table "public"."decision_question_risks" from "authenticated";

revoke insert on table "public"."decision_question_risks" from "authenticated";

revoke references on table "public"."decision_question_risks" from "authenticated";

revoke select on table "public"."decision_question_risks" from "authenticated";

revoke trigger on table "public"."decision_question_risks" from "authenticated";

revoke truncate on table "public"."decision_question_risks" from "authenticated";

revoke update on table "public"."decision_question_risks" from "authenticated";

revoke delete on table "public"."decision_question_risks" from "service_role";

revoke insert on table "public"."decision_question_risks" from "service_role";

revoke references on table "public"."decision_question_risks" from "service_role";

revoke select on table "public"."decision_question_risks" from "service_role";

revoke trigger on table "public"."decision_question_risks" from "service_role";

revoke truncate on table "public"."decision_question_risks" from "service_role";

revoke update on table "public"."decision_question_risks" from "service_role";

revoke delete on table "public"."decision_questions" from "anon";

revoke insert on table "public"."decision_questions" from "anon";

revoke references on table "public"."decision_questions" from "anon";

revoke select on table "public"."decision_questions" from "anon";

revoke trigger on table "public"."decision_questions" from "anon";

revoke truncate on table "public"."decision_questions" from "anon";

revoke update on table "public"."decision_questions" from "anon";

revoke delete on table "public"."decision_questions" from "authenticated";

revoke insert on table "public"."decision_questions" from "authenticated";

revoke references on table "public"."decision_questions" from "authenticated";

revoke select on table "public"."decision_questions" from "authenticated";

revoke trigger on table "public"."decision_questions" from "authenticated";

revoke truncate on table "public"."decision_questions" from "authenticated";

revoke update on table "public"."decision_questions" from "authenticated";

revoke delete on table "public"."decision_questions" from "service_role";

revoke insert on table "public"."decision_questions" from "service_role";

revoke references on table "public"."decision_questions" from "service_role";

revoke select on table "public"."decision_questions" from "service_role";

revoke trigger on table "public"."decision_questions" from "service_role";

revoke truncate on table "public"."decision_questions" from "service_role";

revoke update on table "public"."decision_questions" from "service_role";

revoke delete on table "public"."entity_flags" from "anon";

revoke insert on table "public"."entity_flags" from "anon";

revoke references on table "public"."entity_flags" from "anon";

revoke select on table "public"."entity_flags" from "anon";

revoke trigger on table "public"."entity_flags" from "anon";

revoke truncate on table "public"."entity_flags" from "anon";

revoke update on table "public"."entity_flags" from "anon";

revoke delete on table "public"."entity_flags" from "authenticated";

revoke insert on table "public"."entity_flags" from "authenticated";

revoke references on table "public"."entity_flags" from "authenticated";

revoke select on table "public"."entity_flags" from "authenticated";

revoke trigger on table "public"."entity_flags" from "authenticated";

revoke truncate on table "public"."entity_flags" from "authenticated";

revoke update on table "public"."entity_flags" from "authenticated";

revoke delete on table "public"."entity_flags" from "service_role";

revoke insert on table "public"."entity_flags" from "service_role";

revoke references on table "public"."entity_flags" from "service_role";

revoke select on table "public"."entity_flags" from "service_role";

revoke trigger on table "public"."entity_flags" from "service_role";

revoke truncate on table "public"."entity_flags" from "service_role";

revoke update on table "public"."entity_flags" from "service_role";

revoke delete on table "public"."evidence" from "anon";

revoke insert on table "public"."evidence" from "anon";

revoke references on table "public"."evidence" from "anon";

revoke select on table "public"."evidence" from "anon";

revoke trigger on table "public"."evidence" from "anon";

revoke truncate on table "public"."evidence" from "anon";

revoke update on table "public"."evidence" from "anon";

revoke delete on table "public"."evidence" from "authenticated";

revoke insert on table "public"."evidence" from "authenticated";

revoke references on table "public"."evidence" from "authenticated";

revoke select on table "public"."evidence" from "authenticated";

revoke trigger on table "public"."evidence" from "authenticated";

revoke truncate on table "public"."evidence" from "authenticated";

revoke update on table "public"."evidence" from "authenticated";

revoke delete on table "public"."evidence" from "service_role";

revoke insert on table "public"."evidence" from "service_role";

revoke references on table "public"."evidence" from "service_role";

revoke select on table "public"."evidence" from "service_role";

revoke trigger on table "public"."evidence" from "service_role";

revoke truncate on table "public"."evidence" from "service_role";

revoke update on table "public"."evidence" from "service_role";

revoke delete on table "public"."evidence_facet" from "anon";

revoke insert on table "public"."evidence_facet" from "anon";

revoke references on table "public"."evidence_facet" from "anon";

revoke select on table "public"."evidence_facet" from "anon";

revoke trigger on table "public"."evidence_facet" from "anon";

revoke truncate on table "public"."evidence_facet" from "anon";

revoke update on table "public"."evidence_facet" from "anon";

revoke delete on table "public"."evidence_facet" from "authenticated";

revoke insert on table "public"."evidence_facet" from "authenticated";

revoke references on table "public"."evidence_facet" from "authenticated";

revoke select on table "public"."evidence_facet" from "authenticated";

revoke trigger on table "public"."evidence_facet" from "authenticated";

revoke truncate on table "public"."evidence_facet" from "authenticated";

revoke update on table "public"."evidence_facet" from "authenticated";

revoke delete on table "public"."evidence_facet" from "service_role";

revoke insert on table "public"."evidence_facet" from "service_role";

revoke references on table "public"."evidence_facet" from "service_role";

revoke select on table "public"."evidence_facet" from "service_role";

revoke trigger on table "public"."evidence_facet" from "service_role";

revoke truncate on table "public"."evidence_facet" from "service_role";

revoke update on table "public"."evidence_facet" from "service_role";

revoke delete on table "public"."evidence_people" from "anon";

revoke insert on table "public"."evidence_people" from "anon";

revoke references on table "public"."evidence_people" from "anon";

revoke select on table "public"."evidence_people" from "anon";

revoke trigger on table "public"."evidence_people" from "anon";

revoke truncate on table "public"."evidence_people" from "anon";

revoke update on table "public"."evidence_people" from "anon";

revoke delete on table "public"."evidence_people" from "authenticated";

revoke insert on table "public"."evidence_people" from "authenticated";

revoke references on table "public"."evidence_people" from "authenticated";

revoke select on table "public"."evidence_people" from "authenticated";

revoke trigger on table "public"."evidence_people" from "authenticated";

revoke truncate on table "public"."evidence_people" from "authenticated";

revoke update on table "public"."evidence_people" from "authenticated";

revoke delete on table "public"."evidence_people" from "service_role";

revoke insert on table "public"."evidence_people" from "service_role";

revoke references on table "public"."evidence_people" from "service_role";

revoke select on table "public"."evidence_people" from "service_role";

revoke trigger on table "public"."evidence_people" from "service_role";

revoke truncate on table "public"."evidence_people" from "service_role";

revoke update on table "public"."evidence_people" from "service_role";

revoke delete on table "public"."evidence_tag" from "anon";

revoke insert on table "public"."evidence_tag" from "anon";

revoke references on table "public"."evidence_tag" from "anon";

revoke select on table "public"."evidence_tag" from "anon";

revoke trigger on table "public"."evidence_tag" from "anon";

revoke truncate on table "public"."evidence_tag" from "anon";

revoke update on table "public"."evidence_tag" from "anon";

revoke delete on table "public"."evidence_tag" from "authenticated";

revoke insert on table "public"."evidence_tag" from "authenticated";

revoke references on table "public"."evidence_tag" from "authenticated";

revoke select on table "public"."evidence_tag" from "authenticated";

revoke trigger on table "public"."evidence_tag" from "authenticated";

revoke truncate on table "public"."evidence_tag" from "authenticated";

revoke update on table "public"."evidence_tag" from "authenticated";

revoke delete on table "public"."evidence_tag" from "service_role";

revoke insert on table "public"."evidence_tag" from "service_role";

revoke references on table "public"."evidence_tag" from "service_role";

revoke select on table "public"."evidence_tag" from "service_role";

revoke trigger on table "public"."evidence_tag" from "service_role";

revoke truncate on table "public"."evidence_tag" from "service_role";

revoke update on table "public"."evidence_tag" from "service_role";

revoke delete on table "public"."facet_account" from "anon";

revoke insert on table "public"."facet_account" from "anon";

revoke references on table "public"."facet_account" from "anon";

revoke select on table "public"."facet_account" from "anon";

revoke trigger on table "public"."facet_account" from "anon";

revoke truncate on table "public"."facet_account" from "anon";

revoke update on table "public"."facet_account" from "anon";

revoke delete on table "public"."facet_account" from "authenticated";

revoke insert on table "public"."facet_account" from "authenticated";

revoke references on table "public"."facet_account" from "authenticated";

revoke select on table "public"."facet_account" from "authenticated";

revoke trigger on table "public"."facet_account" from "authenticated";

revoke truncate on table "public"."facet_account" from "authenticated";

revoke update on table "public"."facet_account" from "authenticated";

revoke delete on table "public"."facet_account" from "service_role";

revoke insert on table "public"."facet_account" from "service_role";

revoke references on table "public"."facet_account" from "service_role";

revoke select on table "public"."facet_account" from "service_role";

revoke trigger on table "public"."facet_account" from "service_role";

revoke truncate on table "public"."facet_account" from "service_role";

revoke update on table "public"."facet_account" from "service_role";

revoke delete on table "public"."facet_global" from "anon";

revoke insert on table "public"."facet_global" from "anon";

revoke references on table "public"."facet_global" from "anon";

revoke select on table "public"."facet_global" from "anon";

revoke trigger on table "public"."facet_global" from "anon";

revoke truncate on table "public"."facet_global" from "anon";

revoke update on table "public"."facet_global" from "anon";

revoke delete on table "public"."facet_global" from "authenticated";

revoke insert on table "public"."facet_global" from "authenticated";

revoke references on table "public"."facet_global" from "authenticated";

revoke select on table "public"."facet_global" from "authenticated";

revoke trigger on table "public"."facet_global" from "authenticated";

revoke truncate on table "public"."facet_global" from "authenticated";

revoke update on table "public"."facet_global" from "authenticated";

revoke delete on table "public"."facet_global" from "service_role";

revoke insert on table "public"."facet_global" from "service_role";

revoke references on table "public"."facet_global" from "service_role";

revoke select on table "public"."facet_global" from "service_role";

revoke trigger on table "public"."facet_global" from "service_role";

revoke truncate on table "public"."facet_global" from "service_role";

revoke update on table "public"."facet_global" from "service_role";

revoke delete on table "public"."facet_kind_global" from "anon";

revoke insert on table "public"."facet_kind_global" from "anon";

revoke references on table "public"."facet_kind_global" from "anon";

revoke select on table "public"."facet_kind_global" from "anon";

revoke trigger on table "public"."facet_kind_global" from "anon";

revoke truncate on table "public"."facet_kind_global" from "anon";

revoke update on table "public"."facet_kind_global" from "anon";

revoke delete on table "public"."facet_kind_global" from "authenticated";

revoke insert on table "public"."facet_kind_global" from "authenticated";

revoke references on table "public"."facet_kind_global" from "authenticated";

revoke select on table "public"."facet_kind_global" from "authenticated";

revoke trigger on table "public"."facet_kind_global" from "authenticated";

revoke truncate on table "public"."facet_kind_global" from "authenticated";

revoke update on table "public"."facet_kind_global" from "authenticated";

revoke delete on table "public"."facet_kind_global" from "service_role";

revoke insert on table "public"."facet_kind_global" from "service_role";

revoke references on table "public"."facet_kind_global" from "service_role";

revoke select on table "public"."facet_kind_global" from "service_role";

revoke trigger on table "public"."facet_kind_global" from "service_role";

revoke truncate on table "public"."facet_kind_global" from "service_role";

revoke update on table "public"."facet_kind_global" from "service_role";

revoke delete on table "public"."icp_recommendations" from "anon";

revoke insert on table "public"."icp_recommendations" from "anon";

revoke references on table "public"."icp_recommendations" from "anon";

revoke select on table "public"."icp_recommendations" from "anon";

revoke trigger on table "public"."icp_recommendations" from "anon";

revoke truncate on table "public"."icp_recommendations" from "anon";

revoke update on table "public"."icp_recommendations" from "anon";

revoke delete on table "public"."icp_recommendations" from "authenticated";

revoke insert on table "public"."icp_recommendations" from "authenticated";

revoke references on table "public"."icp_recommendations" from "authenticated";

revoke select on table "public"."icp_recommendations" from "authenticated";

revoke trigger on table "public"."icp_recommendations" from "authenticated";

revoke truncate on table "public"."icp_recommendations" from "authenticated";

revoke update on table "public"."icp_recommendations" from "authenticated";

revoke delete on table "public"."icp_recommendations" from "service_role";

revoke insert on table "public"."icp_recommendations" from "service_role";

revoke references on table "public"."icp_recommendations" from "service_role";

revoke select on table "public"."icp_recommendations" from "service_role";

revoke trigger on table "public"."icp_recommendations" from "service_role";

revoke truncate on table "public"."icp_recommendations" from "service_role";

revoke update on table "public"."icp_recommendations" from "service_role";

revoke delete on table "public"."insight_tags" from "anon";

revoke insert on table "public"."insight_tags" from "anon";

revoke references on table "public"."insight_tags" from "anon";

revoke select on table "public"."insight_tags" from "anon";

revoke trigger on table "public"."insight_tags" from "anon";

revoke truncate on table "public"."insight_tags" from "anon";

revoke update on table "public"."insight_tags" from "anon";

revoke delete on table "public"."insight_tags" from "authenticated";

revoke insert on table "public"."insight_tags" from "authenticated";

revoke references on table "public"."insight_tags" from "authenticated";

revoke select on table "public"."insight_tags" from "authenticated";

revoke trigger on table "public"."insight_tags" from "authenticated";

revoke truncate on table "public"."insight_tags" from "authenticated";

revoke update on table "public"."insight_tags" from "authenticated";

revoke delete on table "public"."insight_tags" from "service_role";

revoke insert on table "public"."insight_tags" from "service_role";

revoke references on table "public"."insight_tags" from "service_role";

revoke select on table "public"."insight_tags" from "service_role";

revoke trigger on table "public"."insight_tags" from "service_role";

revoke truncate on table "public"."insight_tags" from "service_role";

revoke update on table "public"."insight_tags" from "service_role";

revoke delete on table "public"."insights" from "anon";

revoke insert on table "public"."insights" from "anon";

revoke references on table "public"."insights" from "anon";

revoke select on table "public"."insights" from "anon";

revoke trigger on table "public"."insights" from "anon";

revoke truncate on table "public"."insights" from "anon";

revoke update on table "public"."insights" from "anon";

revoke delete on table "public"."insights" from "authenticated";

revoke insert on table "public"."insights" from "authenticated";

revoke references on table "public"."insights" from "authenticated";

revoke select on table "public"."insights" from "authenticated";

revoke trigger on table "public"."insights" from "authenticated";

revoke truncate on table "public"."insights" from "authenticated";

revoke update on table "public"."insights" from "authenticated";

revoke delete on table "public"."insights" from "service_role";

revoke insert on table "public"."insights" from "service_role";

revoke references on table "public"."insights" from "service_role";

revoke select on table "public"."insights" from "service_role";

revoke trigger on table "public"."insights" from "service_role";

revoke truncate on table "public"."insights" from "service_role";

revoke update on table "public"."insights" from "service_role";

revoke delete on table "public"."interview_people" from "anon";

revoke insert on table "public"."interview_people" from "anon";

revoke references on table "public"."interview_people" from "anon";

revoke select on table "public"."interview_people" from "anon";

revoke trigger on table "public"."interview_people" from "anon";

revoke truncate on table "public"."interview_people" from "anon";

revoke update on table "public"."interview_people" from "anon";

revoke delete on table "public"."interview_people" from "authenticated";

revoke insert on table "public"."interview_people" from "authenticated";

revoke references on table "public"."interview_people" from "authenticated";

revoke select on table "public"."interview_people" from "authenticated";

revoke trigger on table "public"."interview_people" from "authenticated";

revoke truncate on table "public"."interview_people" from "authenticated";

revoke update on table "public"."interview_people" from "authenticated";

revoke delete on table "public"."interview_people" from "service_role";

revoke insert on table "public"."interview_people" from "service_role";

revoke references on table "public"."interview_people" from "service_role";

revoke select on table "public"."interview_people" from "service_role";

revoke trigger on table "public"."interview_people" from "service_role";

revoke truncate on table "public"."interview_people" from "service_role";

revoke update on table "public"."interview_people" from "service_role";

revoke delete on table "public"."interview_prompt_bias_checks" from "anon";

revoke insert on table "public"."interview_prompt_bias_checks" from "anon";

revoke references on table "public"."interview_prompt_bias_checks" from "anon";

revoke select on table "public"."interview_prompt_bias_checks" from "anon";

revoke trigger on table "public"."interview_prompt_bias_checks" from "anon";

revoke truncate on table "public"."interview_prompt_bias_checks" from "anon";

revoke update on table "public"."interview_prompt_bias_checks" from "anon";

revoke delete on table "public"."interview_prompt_bias_checks" from "authenticated";

revoke insert on table "public"."interview_prompt_bias_checks" from "authenticated";

revoke references on table "public"."interview_prompt_bias_checks" from "authenticated";

revoke select on table "public"."interview_prompt_bias_checks" from "authenticated";

revoke trigger on table "public"."interview_prompt_bias_checks" from "authenticated";

revoke truncate on table "public"."interview_prompt_bias_checks" from "authenticated";

revoke update on table "public"."interview_prompt_bias_checks" from "authenticated";

revoke delete on table "public"."interview_prompt_bias_checks" from "service_role";

revoke insert on table "public"."interview_prompt_bias_checks" from "service_role";

revoke references on table "public"."interview_prompt_bias_checks" from "service_role";

revoke select on table "public"."interview_prompt_bias_checks" from "service_role";

revoke trigger on table "public"."interview_prompt_bias_checks" from "service_role";

revoke truncate on table "public"."interview_prompt_bias_checks" from "service_role";

revoke update on table "public"."interview_prompt_bias_checks" from "service_role";

revoke delete on table "public"."interview_prompt_followups" from "anon";

revoke insert on table "public"."interview_prompt_followups" from "anon";

revoke references on table "public"."interview_prompt_followups" from "anon";

revoke select on table "public"."interview_prompt_followups" from "anon";

revoke trigger on table "public"."interview_prompt_followups" from "anon";

revoke truncate on table "public"."interview_prompt_followups" from "anon";

revoke update on table "public"."interview_prompt_followups" from "anon";

revoke delete on table "public"."interview_prompt_followups" from "authenticated";

revoke insert on table "public"."interview_prompt_followups" from "authenticated";

revoke references on table "public"."interview_prompt_followups" from "authenticated";

revoke select on table "public"."interview_prompt_followups" from "authenticated";

revoke trigger on table "public"."interview_prompt_followups" from "authenticated";

revoke truncate on table "public"."interview_prompt_followups" from "authenticated";

revoke update on table "public"."interview_prompt_followups" from "authenticated";

revoke delete on table "public"."interview_prompt_followups" from "service_role";

revoke insert on table "public"."interview_prompt_followups" from "service_role";

revoke references on table "public"."interview_prompt_followups" from "service_role";

revoke select on table "public"."interview_prompt_followups" from "service_role";

revoke trigger on table "public"."interview_prompt_followups" from "service_role";

revoke truncate on table "public"."interview_prompt_followups" from "service_role";

revoke update on table "public"."interview_prompt_followups" from "service_role";

revoke delete on table "public"."interview_prompt_research_questions" from "anon";

revoke insert on table "public"."interview_prompt_research_questions" from "anon";

revoke references on table "public"."interview_prompt_research_questions" from "anon";

revoke select on table "public"."interview_prompt_research_questions" from "anon";

revoke trigger on table "public"."interview_prompt_research_questions" from "anon";

revoke truncate on table "public"."interview_prompt_research_questions" from "anon";

revoke update on table "public"."interview_prompt_research_questions" from "anon";

revoke delete on table "public"."interview_prompt_research_questions" from "authenticated";

revoke insert on table "public"."interview_prompt_research_questions" from "authenticated";

revoke references on table "public"."interview_prompt_research_questions" from "authenticated";

revoke select on table "public"."interview_prompt_research_questions" from "authenticated";

revoke trigger on table "public"."interview_prompt_research_questions" from "authenticated";

revoke truncate on table "public"."interview_prompt_research_questions" from "authenticated";

revoke update on table "public"."interview_prompt_research_questions" from "authenticated";

revoke delete on table "public"."interview_prompt_research_questions" from "service_role";

revoke insert on table "public"."interview_prompt_research_questions" from "service_role";

revoke references on table "public"."interview_prompt_research_questions" from "service_role";

revoke select on table "public"."interview_prompt_research_questions" from "service_role";

revoke trigger on table "public"."interview_prompt_research_questions" from "service_role";

revoke truncate on table "public"."interview_prompt_research_questions" from "service_role";

revoke update on table "public"."interview_prompt_research_questions" from "service_role";

revoke delete on table "public"."interview_prompts" from "anon";

revoke insert on table "public"."interview_prompts" from "anon";

revoke references on table "public"."interview_prompts" from "anon";

revoke select on table "public"."interview_prompts" from "anon";

revoke trigger on table "public"."interview_prompts" from "anon";

revoke truncate on table "public"."interview_prompts" from "anon";

revoke update on table "public"."interview_prompts" from "anon";

revoke delete on table "public"."interview_prompts" from "authenticated";

revoke insert on table "public"."interview_prompts" from "authenticated";

revoke references on table "public"."interview_prompts" from "authenticated";

revoke select on table "public"."interview_prompts" from "authenticated";

revoke trigger on table "public"."interview_prompts" from "authenticated";

revoke truncate on table "public"."interview_prompts" from "authenticated";

revoke update on table "public"."interview_prompts" from "authenticated";

revoke delete on table "public"."interview_prompts" from "service_role";

revoke insert on table "public"."interview_prompts" from "service_role";

revoke references on table "public"."interview_prompts" from "service_role";

revoke select on table "public"."interview_prompts" from "service_role";

revoke trigger on table "public"."interview_prompts" from "service_role";

revoke truncate on table "public"."interview_prompts" from "service_role";

revoke update on table "public"."interview_prompts" from "service_role";

revoke delete on table "public"."interview_tags" from "anon";

revoke insert on table "public"."interview_tags" from "anon";

revoke references on table "public"."interview_tags" from "anon";

revoke select on table "public"."interview_tags" from "anon";

revoke trigger on table "public"."interview_tags" from "anon";

revoke truncate on table "public"."interview_tags" from "anon";

revoke update on table "public"."interview_tags" from "anon";

revoke delete on table "public"."interview_tags" from "authenticated";

revoke insert on table "public"."interview_tags" from "authenticated";

revoke references on table "public"."interview_tags" from "authenticated";

revoke select on table "public"."interview_tags" from "authenticated";

revoke trigger on table "public"."interview_tags" from "authenticated";

revoke truncate on table "public"."interview_tags" from "authenticated";

revoke update on table "public"."interview_tags" from "authenticated";

revoke delete on table "public"."interview_tags" from "service_role";

revoke insert on table "public"."interview_tags" from "service_role";

revoke references on table "public"."interview_tags" from "service_role";

revoke select on table "public"."interview_tags" from "service_role";

revoke trigger on table "public"."interview_tags" from "service_role";

revoke truncate on table "public"."interview_tags" from "service_role";

revoke update on table "public"."interview_tags" from "service_role";

revoke delete on table "public"."interviews" from "anon";

revoke insert on table "public"."interviews" from "anon";

revoke references on table "public"."interviews" from "anon";

revoke select on table "public"."interviews" from "anon";

revoke trigger on table "public"."interviews" from "anon";

revoke truncate on table "public"."interviews" from "anon";

revoke update on table "public"."interviews" from "anon";

revoke delete on table "public"."interviews" from "authenticated";

revoke insert on table "public"."interviews" from "authenticated";

revoke references on table "public"."interviews" from "authenticated";

revoke select on table "public"."interviews" from "authenticated";

revoke trigger on table "public"."interviews" from "authenticated";

revoke truncate on table "public"."interviews" from "authenticated";

revoke update on table "public"."interviews" from "authenticated";

revoke delete on table "public"."interviews" from "service_role";

revoke insert on table "public"."interviews" from "service_role";

revoke references on table "public"."interviews" from "service_role";

revoke select on table "public"."interviews" from "service_role";

revoke trigger on table "public"."interviews" from "service_role";

revoke truncate on table "public"."interviews" from "service_role";

revoke update on table "public"."interviews" from "service_role";

revoke delete on table "public"."opportunities" from "anon";

revoke insert on table "public"."opportunities" from "anon";

revoke references on table "public"."opportunities" from "anon";

revoke select on table "public"."opportunities" from "anon";

revoke trigger on table "public"."opportunities" from "anon";

revoke truncate on table "public"."opportunities" from "anon";

revoke update on table "public"."opportunities" from "anon";

revoke delete on table "public"."opportunities" from "authenticated";

revoke insert on table "public"."opportunities" from "authenticated";

revoke references on table "public"."opportunities" from "authenticated";

revoke select on table "public"."opportunities" from "authenticated";

revoke trigger on table "public"."opportunities" from "authenticated";

revoke truncate on table "public"."opportunities" from "authenticated";

revoke update on table "public"."opportunities" from "authenticated";

revoke delete on table "public"."opportunities" from "service_role";

revoke insert on table "public"."opportunities" from "service_role";

revoke references on table "public"."opportunities" from "service_role";

revoke select on table "public"."opportunities" from "service_role";

revoke trigger on table "public"."opportunities" from "service_role";

revoke truncate on table "public"."opportunities" from "service_role";

revoke update on table "public"."opportunities" from "service_role";

revoke delete on table "public"."opportunity_insights" from "anon";

revoke insert on table "public"."opportunity_insights" from "anon";

revoke references on table "public"."opportunity_insights" from "anon";

revoke select on table "public"."opportunity_insights" from "anon";

revoke trigger on table "public"."opportunity_insights" from "anon";

revoke truncate on table "public"."opportunity_insights" from "anon";

revoke update on table "public"."opportunity_insights" from "anon";

revoke delete on table "public"."opportunity_insights" from "authenticated";

revoke insert on table "public"."opportunity_insights" from "authenticated";

revoke references on table "public"."opportunity_insights" from "authenticated";

revoke select on table "public"."opportunity_insights" from "authenticated";

revoke trigger on table "public"."opportunity_insights" from "authenticated";

revoke truncate on table "public"."opportunity_insights" from "authenticated";

revoke update on table "public"."opportunity_insights" from "authenticated";

revoke delete on table "public"."opportunity_insights" from "service_role";

revoke insert on table "public"."opportunity_insights" from "service_role";

revoke references on table "public"."opportunity_insights" from "service_role";

revoke select on table "public"."opportunity_insights" from "service_role";

revoke trigger on table "public"."opportunity_insights" from "service_role";

revoke truncate on table "public"."opportunity_insights" from "service_role";

revoke update on table "public"."opportunity_insights" from "service_role";

revoke delete on table "public"."organizations" from "anon";

revoke insert on table "public"."organizations" from "anon";

revoke references on table "public"."organizations" from "anon";

revoke select on table "public"."organizations" from "anon";

revoke trigger on table "public"."organizations" from "anon";

revoke truncate on table "public"."organizations" from "anon";

revoke update on table "public"."organizations" from "anon";

revoke delete on table "public"."organizations" from "authenticated";

revoke insert on table "public"."organizations" from "authenticated";

revoke references on table "public"."organizations" from "authenticated";

revoke select on table "public"."organizations" from "authenticated";

revoke trigger on table "public"."organizations" from "authenticated";

revoke truncate on table "public"."organizations" from "authenticated";

revoke update on table "public"."organizations" from "authenticated";

revoke delete on table "public"."organizations" from "service_role";

revoke insert on table "public"."organizations" from "service_role";

revoke references on table "public"."organizations" from "service_role";

revoke select on table "public"."organizations" from "service_role";

revoke trigger on table "public"."organizations" from "service_role";

revoke truncate on table "public"."organizations" from "service_role";

revoke update on table "public"."organizations" from "service_role";

revoke delete on table "public"."pain_matrix_cache" from "anon";

revoke insert on table "public"."pain_matrix_cache" from "anon";

revoke references on table "public"."pain_matrix_cache" from "anon";

revoke select on table "public"."pain_matrix_cache" from "anon";

revoke trigger on table "public"."pain_matrix_cache" from "anon";

revoke truncate on table "public"."pain_matrix_cache" from "anon";

revoke update on table "public"."pain_matrix_cache" from "anon";

revoke delete on table "public"."pain_matrix_cache" from "authenticated";

revoke insert on table "public"."pain_matrix_cache" from "authenticated";

revoke references on table "public"."pain_matrix_cache" from "authenticated";

revoke select on table "public"."pain_matrix_cache" from "authenticated";

revoke trigger on table "public"."pain_matrix_cache" from "authenticated";

revoke truncate on table "public"."pain_matrix_cache" from "authenticated";

revoke update on table "public"."pain_matrix_cache" from "authenticated";

revoke delete on table "public"."pain_matrix_cache" from "service_role";

revoke insert on table "public"."pain_matrix_cache" from "service_role";

revoke references on table "public"."pain_matrix_cache" from "service_role";

revoke select on table "public"."pain_matrix_cache" from "service_role";

revoke trigger on table "public"."pain_matrix_cache" from "service_role";

revoke truncate on table "public"."pain_matrix_cache" from "service_role";

revoke update on table "public"."pain_matrix_cache" from "service_role";

revoke delete on table "public"."people" from "anon";

revoke insert on table "public"."people" from "anon";

revoke references on table "public"."people" from "anon";

revoke select on table "public"."people" from "anon";

revoke trigger on table "public"."people" from "anon";

revoke truncate on table "public"."people" from "anon";

revoke update on table "public"."people" from "anon";

revoke delete on table "public"."people" from "authenticated";

revoke insert on table "public"."people" from "authenticated";

revoke references on table "public"."people" from "authenticated";

revoke select on table "public"."people" from "authenticated";

revoke trigger on table "public"."people" from "authenticated";

revoke truncate on table "public"."people" from "authenticated";

revoke update on table "public"."people" from "authenticated";

revoke delete on table "public"."people" from "service_role";

revoke insert on table "public"."people" from "service_role";

revoke references on table "public"."people" from "service_role";

revoke select on table "public"."people" from "service_role";

revoke trigger on table "public"."people" from "service_role";

revoke truncate on table "public"."people" from "service_role";

revoke update on table "public"."people" from "service_role";

revoke delete on table "public"."people_organizations" from "anon";

revoke insert on table "public"."people_organizations" from "anon";

revoke references on table "public"."people_organizations" from "anon";

revoke select on table "public"."people_organizations" from "anon";

revoke trigger on table "public"."people_organizations" from "anon";

revoke truncate on table "public"."people_organizations" from "anon";

revoke update on table "public"."people_organizations" from "anon";

revoke delete on table "public"."people_organizations" from "authenticated";

revoke insert on table "public"."people_organizations" from "authenticated";

revoke references on table "public"."people_organizations" from "authenticated";

revoke select on table "public"."people_organizations" from "authenticated";

revoke trigger on table "public"."people_organizations" from "authenticated";

revoke truncate on table "public"."people_organizations" from "authenticated";

revoke update on table "public"."people_organizations" from "authenticated";

revoke delete on table "public"."people_organizations" from "service_role";

revoke insert on table "public"."people_organizations" from "service_role";

revoke references on table "public"."people_organizations" from "service_role";

revoke select on table "public"."people_organizations" from "service_role";

revoke trigger on table "public"."people_organizations" from "service_role";

revoke truncate on table "public"."people_organizations" from "service_role";

revoke update on table "public"."people_organizations" from "service_role";

revoke delete on table "public"."people_personas" from "anon";

revoke insert on table "public"."people_personas" from "anon";

revoke references on table "public"."people_personas" from "anon";

revoke select on table "public"."people_personas" from "anon";

revoke trigger on table "public"."people_personas" from "anon";

revoke truncate on table "public"."people_personas" from "anon";

revoke update on table "public"."people_personas" from "anon";

revoke delete on table "public"."people_personas" from "authenticated";

revoke insert on table "public"."people_personas" from "authenticated";

revoke references on table "public"."people_personas" from "authenticated";

revoke select on table "public"."people_personas" from "authenticated";

revoke trigger on table "public"."people_personas" from "authenticated";

revoke truncate on table "public"."people_personas" from "authenticated";

revoke update on table "public"."people_personas" from "authenticated";

revoke delete on table "public"."people_personas" from "service_role";

revoke insert on table "public"."people_personas" from "service_role";

revoke references on table "public"."people_personas" from "service_role";

revoke select on table "public"."people_personas" from "service_role";

revoke trigger on table "public"."people_personas" from "service_role";

revoke truncate on table "public"."people_personas" from "service_role";

revoke update on table "public"."people_personas" from "service_role";

revoke delete on table "public"."person_facet" from "anon";

revoke insert on table "public"."person_facet" from "anon";

revoke references on table "public"."person_facet" from "anon";

revoke select on table "public"."person_facet" from "anon";

revoke trigger on table "public"."person_facet" from "anon";

revoke truncate on table "public"."person_facet" from "anon";

revoke update on table "public"."person_facet" from "anon";

revoke delete on table "public"."person_facet" from "authenticated";

revoke insert on table "public"."person_facet" from "authenticated";

revoke references on table "public"."person_facet" from "authenticated";

revoke select on table "public"."person_facet" from "authenticated";

revoke trigger on table "public"."person_facet" from "authenticated";

revoke truncate on table "public"."person_facet" from "authenticated";

revoke update on table "public"."person_facet" from "authenticated";

revoke delete on table "public"."person_facet" from "service_role";

revoke insert on table "public"."person_facet" from "service_role";

revoke references on table "public"."person_facet" from "service_role";

revoke select on table "public"."person_facet" from "service_role";

revoke trigger on table "public"."person_facet" from "service_role";

revoke truncate on table "public"."person_facet" from "service_role";

revoke update on table "public"."person_facet" from "service_role";

revoke delete on table "public"."person_scale" from "anon";

revoke insert on table "public"."person_scale" from "anon";

revoke references on table "public"."person_scale" from "anon";

revoke select on table "public"."person_scale" from "anon";

revoke trigger on table "public"."person_scale" from "anon";

revoke truncate on table "public"."person_scale" from "anon";

revoke update on table "public"."person_scale" from "anon";

revoke delete on table "public"."person_scale" from "authenticated";

revoke insert on table "public"."person_scale" from "authenticated";

revoke references on table "public"."person_scale" from "authenticated";

revoke select on table "public"."person_scale" from "authenticated";

revoke trigger on table "public"."person_scale" from "authenticated";

revoke truncate on table "public"."person_scale" from "authenticated";

revoke update on table "public"."person_scale" from "authenticated";

revoke delete on table "public"."person_scale" from "service_role";

revoke insert on table "public"."person_scale" from "service_role";

revoke references on table "public"."person_scale" from "service_role";

revoke select on table "public"."person_scale" from "service_role";

revoke trigger on table "public"."person_scale" from "service_role";

revoke truncate on table "public"."person_scale" from "service_role";

revoke update on table "public"."person_scale" from "service_role";

revoke delete on table "public"."persona_insights" from "anon";

revoke insert on table "public"."persona_insights" from "anon";

revoke references on table "public"."persona_insights" from "anon";

revoke select on table "public"."persona_insights" from "anon";

revoke trigger on table "public"."persona_insights" from "anon";

revoke truncate on table "public"."persona_insights" from "anon";

revoke update on table "public"."persona_insights" from "anon";

revoke delete on table "public"."persona_insights" from "authenticated";

revoke insert on table "public"."persona_insights" from "authenticated";

revoke references on table "public"."persona_insights" from "authenticated";

revoke select on table "public"."persona_insights" from "authenticated";

revoke trigger on table "public"."persona_insights" from "authenticated";

revoke truncate on table "public"."persona_insights" from "authenticated";

revoke update on table "public"."persona_insights" from "authenticated";

revoke delete on table "public"."persona_insights" from "service_role";

revoke insert on table "public"."persona_insights" from "service_role";

revoke references on table "public"."persona_insights" from "service_role";

revoke select on table "public"."persona_insights" from "service_role";

revoke trigger on table "public"."persona_insights" from "service_role";

revoke truncate on table "public"."persona_insights" from "service_role";

revoke update on table "public"."persona_insights" from "service_role";

revoke delete on table "public"."personas" from "anon";

revoke insert on table "public"."personas" from "anon";

revoke references on table "public"."personas" from "anon";

revoke select on table "public"."personas" from "anon";

revoke trigger on table "public"."personas" from "anon";

revoke truncate on table "public"."personas" from "anon";

revoke update on table "public"."personas" from "anon";

revoke delete on table "public"."personas" from "authenticated";

revoke insert on table "public"."personas" from "authenticated";

revoke references on table "public"."personas" from "authenticated";

revoke select on table "public"."personas" from "authenticated";

revoke trigger on table "public"."personas" from "authenticated";

revoke truncate on table "public"."personas" from "authenticated";

revoke update on table "public"."personas" from "authenticated";

revoke delete on table "public"."personas" from "service_role";

revoke insert on table "public"."personas" from "service_role";

revoke references on table "public"."personas" from "service_role";

revoke select on table "public"."personas" from "service_role";

revoke trigger on table "public"."personas" from "service_role";

revoke truncate on table "public"."personas" from "service_role";

revoke update on table "public"."personas" from "service_role";

revoke delete on table "public"."project_answer_evidence" from "anon";

revoke insert on table "public"."project_answer_evidence" from "anon";

revoke references on table "public"."project_answer_evidence" from "anon";

revoke select on table "public"."project_answer_evidence" from "anon";

revoke trigger on table "public"."project_answer_evidence" from "anon";

revoke truncate on table "public"."project_answer_evidence" from "anon";

revoke update on table "public"."project_answer_evidence" from "anon";

revoke delete on table "public"."project_answer_evidence" from "authenticated";

revoke insert on table "public"."project_answer_evidence" from "authenticated";

revoke references on table "public"."project_answer_evidence" from "authenticated";

revoke select on table "public"."project_answer_evidence" from "authenticated";

revoke trigger on table "public"."project_answer_evidence" from "authenticated";

revoke truncate on table "public"."project_answer_evidence" from "authenticated";

revoke update on table "public"."project_answer_evidence" from "authenticated";

revoke delete on table "public"."project_answer_evidence" from "service_role";

revoke insert on table "public"."project_answer_evidence" from "service_role";

revoke references on table "public"."project_answer_evidence" from "service_role";

revoke select on table "public"."project_answer_evidence" from "service_role";

revoke trigger on table "public"."project_answer_evidence" from "service_role";

revoke truncate on table "public"."project_answer_evidence" from "service_role";

revoke update on table "public"."project_answer_evidence" from "service_role";

revoke delete on table "public"."project_answers" from "anon";

revoke insert on table "public"."project_answers" from "anon";

revoke references on table "public"."project_answers" from "anon";

revoke select on table "public"."project_answers" from "anon";

revoke trigger on table "public"."project_answers" from "anon";

revoke truncate on table "public"."project_answers" from "anon";

revoke update on table "public"."project_answers" from "anon";

revoke delete on table "public"."project_answers" from "authenticated";

revoke insert on table "public"."project_answers" from "authenticated";

revoke references on table "public"."project_answers" from "authenticated";

revoke select on table "public"."project_answers" from "authenticated";

revoke trigger on table "public"."project_answers" from "authenticated";

revoke truncate on table "public"."project_answers" from "authenticated";

revoke update on table "public"."project_answers" from "authenticated";

revoke delete on table "public"."project_answers" from "service_role";

revoke insert on table "public"."project_answers" from "service_role";

revoke references on table "public"."project_answers" from "service_role";

revoke select on table "public"."project_answers" from "service_role";

revoke trigger on table "public"."project_answers" from "service_role";

revoke truncate on table "public"."project_answers" from "service_role";

revoke update on table "public"."project_answers" from "service_role";

revoke delete on table "public"."project_people" from "anon";

revoke insert on table "public"."project_people" from "anon";

revoke references on table "public"."project_people" from "anon";

revoke select on table "public"."project_people" from "anon";

revoke trigger on table "public"."project_people" from "anon";

revoke truncate on table "public"."project_people" from "anon";

revoke update on table "public"."project_people" from "anon";

revoke delete on table "public"."project_people" from "authenticated";

revoke insert on table "public"."project_people" from "authenticated";

revoke references on table "public"."project_people" from "authenticated";

revoke select on table "public"."project_people" from "authenticated";

revoke trigger on table "public"."project_people" from "authenticated";

revoke truncate on table "public"."project_people" from "authenticated";

revoke update on table "public"."project_people" from "authenticated";

revoke delete on table "public"."project_people" from "service_role";

revoke insert on table "public"."project_people" from "service_role";

revoke references on table "public"."project_people" from "service_role";

revoke select on table "public"."project_people" from "service_role";

revoke trigger on table "public"."project_people" from "service_role";

revoke truncate on table "public"."project_people" from "service_role";

revoke update on table "public"."project_people" from "service_role";

revoke delete on table "public"."project_question_analysis" from "anon";

revoke insert on table "public"."project_question_analysis" from "anon";

revoke references on table "public"."project_question_analysis" from "anon";

revoke select on table "public"."project_question_analysis" from "anon";

revoke trigger on table "public"."project_question_analysis" from "anon";

revoke truncate on table "public"."project_question_analysis" from "anon";

revoke update on table "public"."project_question_analysis" from "anon";

revoke delete on table "public"."project_question_analysis" from "authenticated";

revoke insert on table "public"."project_question_analysis" from "authenticated";

revoke references on table "public"."project_question_analysis" from "authenticated";

revoke select on table "public"."project_question_analysis" from "authenticated";

revoke trigger on table "public"."project_question_analysis" from "authenticated";

revoke truncate on table "public"."project_question_analysis" from "authenticated";

revoke update on table "public"."project_question_analysis" from "authenticated";

revoke delete on table "public"."project_question_analysis" from "service_role";

revoke insert on table "public"."project_question_analysis" from "service_role";

revoke references on table "public"."project_question_analysis" from "service_role";

revoke select on table "public"."project_question_analysis" from "service_role";

revoke trigger on table "public"."project_question_analysis" from "service_role";

revoke truncate on table "public"."project_question_analysis" from "service_role";

revoke update on table "public"."project_question_analysis" from "service_role";

revoke delete on table "public"."project_research_analysis_runs" from "anon";

revoke insert on table "public"."project_research_analysis_runs" from "anon";

revoke references on table "public"."project_research_analysis_runs" from "anon";

revoke select on table "public"."project_research_analysis_runs" from "anon";

revoke trigger on table "public"."project_research_analysis_runs" from "anon";

revoke truncate on table "public"."project_research_analysis_runs" from "anon";

revoke update on table "public"."project_research_analysis_runs" from "anon";

revoke delete on table "public"."project_research_analysis_runs" from "authenticated";

revoke insert on table "public"."project_research_analysis_runs" from "authenticated";

revoke references on table "public"."project_research_analysis_runs" from "authenticated";

revoke select on table "public"."project_research_analysis_runs" from "authenticated";

revoke trigger on table "public"."project_research_analysis_runs" from "authenticated";

revoke truncate on table "public"."project_research_analysis_runs" from "authenticated";

revoke update on table "public"."project_research_analysis_runs" from "authenticated";

revoke delete on table "public"."project_research_analysis_runs" from "service_role";

revoke insert on table "public"."project_research_analysis_runs" from "service_role";

revoke references on table "public"."project_research_analysis_runs" from "service_role";

revoke select on table "public"."project_research_analysis_runs" from "service_role";

revoke trigger on table "public"."project_research_analysis_runs" from "service_role";

revoke truncate on table "public"."project_research_analysis_runs" from "service_role";

revoke update on table "public"."project_research_analysis_runs" from "service_role";

revoke delete on table "public"."project_research_plans" from "anon";

revoke insert on table "public"."project_research_plans" from "anon";

revoke references on table "public"."project_research_plans" from "anon";

revoke select on table "public"."project_research_plans" from "anon";

revoke trigger on table "public"."project_research_plans" from "anon";

revoke truncate on table "public"."project_research_plans" from "anon";

revoke update on table "public"."project_research_plans" from "anon";

revoke delete on table "public"."project_research_plans" from "authenticated";

revoke insert on table "public"."project_research_plans" from "authenticated";

revoke references on table "public"."project_research_plans" from "authenticated";

revoke select on table "public"."project_research_plans" from "authenticated";

revoke trigger on table "public"."project_research_plans" from "authenticated";

revoke truncate on table "public"."project_research_plans" from "authenticated";

revoke update on table "public"."project_research_plans" from "authenticated";

revoke delete on table "public"."project_research_plans" from "service_role";

revoke insert on table "public"."project_research_plans" from "service_role";

revoke references on table "public"."project_research_plans" from "service_role";

revoke select on table "public"."project_research_plans" from "service_role";

revoke trigger on table "public"."project_research_plans" from "service_role";

revoke truncate on table "public"."project_research_plans" from "service_role";

revoke update on table "public"."project_research_plans" from "service_role";

revoke delete on table "public"."project_section_kinds" from "anon";

revoke insert on table "public"."project_section_kinds" from "anon";

revoke references on table "public"."project_section_kinds" from "anon";

revoke select on table "public"."project_section_kinds" from "anon";

revoke trigger on table "public"."project_section_kinds" from "anon";

revoke truncate on table "public"."project_section_kinds" from "anon";

revoke update on table "public"."project_section_kinds" from "anon";

revoke delete on table "public"."project_section_kinds" from "authenticated";

revoke insert on table "public"."project_section_kinds" from "authenticated";

revoke references on table "public"."project_section_kinds" from "authenticated";

revoke select on table "public"."project_section_kinds" from "authenticated";

revoke trigger on table "public"."project_section_kinds" from "authenticated";

revoke truncate on table "public"."project_section_kinds" from "authenticated";

revoke update on table "public"."project_section_kinds" from "authenticated";

revoke delete on table "public"."project_section_kinds" from "service_role";

revoke insert on table "public"."project_section_kinds" from "service_role";

revoke references on table "public"."project_section_kinds" from "service_role";

revoke select on table "public"."project_section_kinds" from "service_role";

revoke trigger on table "public"."project_section_kinds" from "service_role";

revoke truncate on table "public"."project_section_kinds" from "service_role";

revoke update on table "public"."project_section_kinds" from "service_role";

revoke delete on table "public"."project_sections" from "anon";

revoke insert on table "public"."project_sections" from "anon";

revoke references on table "public"."project_sections" from "anon";

revoke select on table "public"."project_sections" from "anon";

revoke trigger on table "public"."project_sections" from "anon";

revoke truncate on table "public"."project_sections" from "anon";

revoke update on table "public"."project_sections" from "anon";

revoke delete on table "public"."project_sections" from "authenticated";

revoke insert on table "public"."project_sections" from "authenticated";

revoke references on table "public"."project_sections" from "authenticated";

revoke select on table "public"."project_sections" from "authenticated";

revoke trigger on table "public"."project_sections" from "authenticated";

revoke truncate on table "public"."project_sections" from "authenticated";

revoke update on table "public"."project_sections" from "authenticated";

revoke delete on table "public"."project_sections" from "service_role";

revoke insert on table "public"."project_sections" from "service_role";

revoke references on table "public"."project_sections" from "service_role";

revoke select on table "public"."project_sections" from "service_role";

revoke trigger on table "public"."project_sections" from "service_role";

revoke truncate on table "public"."project_sections" from "service_role";

revoke update on table "public"."project_sections" from "service_role";

revoke delete on table "public"."projects" from "anon";

revoke insert on table "public"."projects" from "anon";

revoke references on table "public"."projects" from "anon";

revoke select on table "public"."projects" from "anon";

revoke trigger on table "public"."projects" from "anon";

revoke truncate on table "public"."projects" from "anon";

revoke update on table "public"."projects" from "anon";

revoke delete on table "public"."projects" from "authenticated";

revoke insert on table "public"."projects" from "authenticated";

revoke references on table "public"."projects" from "authenticated";

revoke select on table "public"."projects" from "authenticated";

revoke trigger on table "public"."projects" from "authenticated";

revoke truncate on table "public"."projects" from "authenticated";

revoke update on table "public"."projects" from "authenticated";

revoke delete on table "public"."projects" from "service_role";

revoke insert on table "public"."projects" from "service_role";

revoke references on table "public"."projects" from "service_role";

revoke select on table "public"."projects" from "service_role";

revoke trigger on table "public"."projects" from "service_role";

revoke truncate on table "public"."projects" from "service_role";

revoke update on table "public"."projects" from "service_role";

revoke delete on table "public"."research_plan_data_sources" from "anon";

revoke insert on table "public"."research_plan_data_sources" from "anon";

revoke references on table "public"."research_plan_data_sources" from "anon";

revoke select on table "public"."research_plan_data_sources" from "anon";

revoke trigger on table "public"."research_plan_data_sources" from "anon";

revoke truncate on table "public"."research_plan_data_sources" from "anon";

revoke update on table "public"."research_plan_data_sources" from "anon";

revoke delete on table "public"."research_plan_data_sources" from "authenticated";

revoke insert on table "public"."research_plan_data_sources" from "authenticated";

revoke references on table "public"."research_plan_data_sources" from "authenticated";

revoke select on table "public"."research_plan_data_sources" from "authenticated";

revoke trigger on table "public"."research_plan_data_sources" from "authenticated";

revoke truncate on table "public"."research_plan_data_sources" from "authenticated";

revoke update on table "public"."research_plan_data_sources" from "authenticated";

revoke delete on table "public"."research_plan_data_sources" from "service_role";

revoke insert on table "public"."research_plan_data_sources" from "service_role";

revoke references on table "public"."research_plan_data_sources" from "service_role";

revoke select on table "public"."research_plan_data_sources" from "service_role";

revoke trigger on table "public"."research_plan_data_sources" from "service_role";

revoke truncate on table "public"."research_plan_data_sources" from "service_role";

revoke update on table "public"."research_plan_data_sources" from "service_role";

revoke delete on table "public"."research_question_evidence_types" from "anon";

revoke insert on table "public"."research_question_evidence_types" from "anon";

revoke references on table "public"."research_question_evidence_types" from "anon";

revoke select on table "public"."research_question_evidence_types" from "anon";

revoke trigger on table "public"."research_question_evidence_types" from "anon";

revoke truncate on table "public"."research_question_evidence_types" from "anon";

revoke update on table "public"."research_question_evidence_types" from "anon";

revoke delete on table "public"."research_question_evidence_types" from "authenticated";

revoke insert on table "public"."research_question_evidence_types" from "authenticated";

revoke references on table "public"."research_question_evidence_types" from "authenticated";

revoke select on table "public"."research_question_evidence_types" from "authenticated";

revoke trigger on table "public"."research_question_evidence_types" from "authenticated";

revoke truncate on table "public"."research_question_evidence_types" from "authenticated";

revoke update on table "public"."research_question_evidence_types" from "authenticated";

revoke delete on table "public"."research_question_evidence_types" from "service_role";

revoke insert on table "public"."research_question_evidence_types" from "service_role";

revoke references on table "public"."research_question_evidence_types" from "service_role";

revoke select on table "public"."research_question_evidence_types" from "service_role";

revoke trigger on table "public"."research_question_evidence_types" from "service_role";

revoke truncate on table "public"."research_question_evidence_types" from "service_role";

revoke update on table "public"."research_question_evidence_types" from "service_role";

revoke delete on table "public"."research_question_methods" from "anon";

revoke insert on table "public"."research_question_methods" from "anon";

revoke references on table "public"."research_question_methods" from "anon";

revoke select on table "public"."research_question_methods" from "anon";

revoke trigger on table "public"."research_question_methods" from "anon";

revoke truncate on table "public"."research_question_methods" from "anon";

revoke update on table "public"."research_question_methods" from "anon";

revoke delete on table "public"."research_question_methods" from "authenticated";

revoke insert on table "public"."research_question_methods" from "authenticated";

revoke references on table "public"."research_question_methods" from "authenticated";

revoke select on table "public"."research_question_methods" from "authenticated";

revoke trigger on table "public"."research_question_methods" from "authenticated";

revoke truncate on table "public"."research_question_methods" from "authenticated";

revoke update on table "public"."research_question_methods" from "authenticated";

revoke delete on table "public"."research_question_methods" from "service_role";

revoke insert on table "public"."research_question_methods" from "service_role";

revoke references on table "public"."research_question_methods" from "service_role";

revoke select on table "public"."research_question_methods" from "service_role";

revoke trigger on table "public"."research_question_methods" from "service_role";

revoke truncate on table "public"."research_question_methods" from "service_role";

revoke update on table "public"."research_question_methods" from "service_role";

revoke delete on table "public"."research_questions" from "anon";

revoke insert on table "public"."research_questions" from "anon";

revoke references on table "public"."research_questions" from "anon";

revoke select on table "public"."research_questions" from "anon";

revoke trigger on table "public"."research_questions" from "anon";

revoke truncate on table "public"."research_questions" from "anon";

revoke update on table "public"."research_questions" from "anon";

revoke delete on table "public"."research_questions" from "authenticated";

revoke insert on table "public"."research_questions" from "authenticated";

revoke references on table "public"."research_questions" from "authenticated";

revoke select on table "public"."research_questions" from "authenticated";

revoke trigger on table "public"."research_questions" from "authenticated";

revoke truncate on table "public"."research_questions" from "authenticated";

revoke update on table "public"."research_questions" from "authenticated";

revoke delete on table "public"."research_questions" from "service_role";

revoke insert on table "public"."research_questions" from "service_role";

revoke references on table "public"."research_questions" from "service_role";

revoke select on table "public"."research_questions" from "service_role";

revoke trigger on table "public"."research_questions" from "service_role";

revoke truncate on table "public"."research_questions" from "service_role";

revoke update on table "public"."research_questions" from "service_role";

revoke delete on table "public"."sales_lens_hygiene_events" from "anon";

revoke insert on table "public"."sales_lens_hygiene_events" from "anon";

revoke references on table "public"."sales_lens_hygiene_events" from "anon";

revoke select on table "public"."sales_lens_hygiene_events" from "anon";

revoke trigger on table "public"."sales_lens_hygiene_events" from "anon";

revoke truncate on table "public"."sales_lens_hygiene_events" from "anon";

revoke update on table "public"."sales_lens_hygiene_events" from "anon";

revoke delete on table "public"."sales_lens_hygiene_events" from "authenticated";

revoke insert on table "public"."sales_lens_hygiene_events" from "authenticated";

revoke references on table "public"."sales_lens_hygiene_events" from "authenticated";

revoke select on table "public"."sales_lens_hygiene_events" from "authenticated";

revoke trigger on table "public"."sales_lens_hygiene_events" from "authenticated";

revoke truncate on table "public"."sales_lens_hygiene_events" from "authenticated";

revoke update on table "public"."sales_lens_hygiene_events" from "authenticated";

revoke delete on table "public"."sales_lens_hygiene_events" from "service_role";

revoke insert on table "public"."sales_lens_hygiene_events" from "service_role";

revoke references on table "public"."sales_lens_hygiene_events" from "service_role";

revoke select on table "public"."sales_lens_hygiene_events" from "service_role";

revoke trigger on table "public"."sales_lens_hygiene_events" from "service_role";

revoke truncate on table "public"."sales_lens_hygiene_events" from "service_role";

revoke update on table "public"."sales_lens_hygiene_events" from "service_role";

revoke delete on table "public"."sales_lens_slots" from "anon";

revoke insert on table "public"."sales_lens_slots" from "anon";

revoke references on table "public"."sales_lens_slots" from "anon";

revoke select on table "public"."sales_lens_slots" from "anon";

revoke trigger on table "public"."sales_lens_slots" from "anon";

revoke truncate on table "public"."sales_lens_slots" from "anon";

revoke update on table "public"."sales_lens_slots" from "anon";

revoke delete on table "public"."sales_lens_slots" from "authenticated";

revoke insert on table "public"."sales_lens_slots" from "authenticated";

revoke references on table "public"."sales_lens_slots" from "authenticated";

revoke select on table "public"."sales_lens_slots" from "authenticated";

revoke trigger on table "public"."sales_lens_slots" from "authenticated";

revoke truncate on table "public"."sales_lens_slots" from "authenticated";

revoke update on table "public"."sales_lens_slots" from "authenticated";

revoke delete on table "public"."sales_lens_slots" from "service_role";

revoke insert on table "public"."sales_lens_slots" from "service_role";

revoke references on table "public"."sales_lens_slots" from "service_role";

revoke select on table "public"."sales_lens_slots" from "service_role";

revoke trigger on table "public"."sales_lens_slots" from "service_role";

revoke truncate on table "public"."sales_lens_slots" from "service_role";

revoke update on table "public"."sales_lens_slots" from "service_role";

revoke delete on table "public"."sales_lens_stakeholders" from "anon";

revoke insert on table "public"."sales_lens_stakeholders" from "anon";

revoke references on table "public"."sales_lens_stakeholders" from "anon";

revoke select on table "public"."sales_lens_stakeholders" from "anon";

revoke trigger on table "public"."sales_lens_stakeholders" from "anon";

revoke truncate on table "public"."sales_lens_stakeholders" from "anon";

revoke update on table "public"."sales_lens_stakeholders" from "anon";

revoke delete on table "public"."sales_lens_stakeholders" from "authenticated";

revoke insert on table "public"."sales_lens_stakeholders" from "authenticated";

revoke references on table "public"."sales_lens_stakeholders" from "authenticated";

revoke select on table "public"."sales_lens_stakeholders" from "authenticated";

revoke trigger on table "public"."sales_lens_stakeholders" from "authenticated";

revoke truncate on table "public"."sales_lens_stakeholders" from "authenticated";

revoke update on table "public"."sales_lens_stakeholders" from "authenticated";

revoke delete on table "public"."sales_lens_stakeholders" from "service_role";

revoke insert on table "public"."sales_lens_stakeholders" from "service_role";

revoke references on table "public"."sales_lens_stakeholders" from "service_role";

revoke select on table "public"."sales_lens_stakeholders" from "service_role";

revoke trigger on table "public"."sales_lens_stakeholders" from "service_role";

revoke truncate on table "public"."sales_lens_stakeholders" from "service_role";

revoke update on table "public"."sales_lens_stakeholders" from "service_role";

revoke delete on table "public"."sales_lens_summaries" from "anon";

revoke insert on table "public"."sales_lens_summaries" from "anon";

revoke references on table "public"."sales_lens_summaries" from "anon";

revoke select on table "public"."sales_lens_summaries" from "anon";

revoke trigger on table "public"."sales_lens_summaries" from "anon";

revoke truncate on table "public"."sales_lens_summaries" from "anon";

revoke update on table "public"."sales_lens_summaries" from "anon";

revoke delete on table "public"."sales_lens_summaries" from "authenticated";

revoke insert on table "public"."sales_lens_summaries" from "authenticated";

revoke references on table "public"."sales_lens_summaries" from "authenticated";

revoke select on table "public"."sales_lens_summaries" from "authenticated";

revoke trigger on table "public"."sales_lens_summaries" from "authenticated";

revoke truncate on table "public"."sales_lens_summaries" from "authenticated";

revoke update on table "public"."sales_lens_summaries" from "authenticated";

revoke delete on table "public"."sales_lens_summaries" from "service_role";

revoke insert on table "public"."sales_lens_summaries" from "service_role";

revoke references on table "public"."sales_lens_summaries" from "service_role";

revoke select on table "public"."sales_lens_summaries" from "service_role";

revoke trigger on table "public"."sales_lens_summaries" from "service_role";

revoke truncate on table "public"."sales_lens_summaries" from "service_role";

revoke update on table "public"."sales_lens_summaries" from "service_role";

revoke delete on table "public"."tags" from "anon";

revoke insert on table "public"."tags" from "anon";

revoke references on table "public"."tags" from "anon";

revoke select on table "public"."tags" from "anon";

revoke trigger on table "public"."tags" from "anon";

revoke truncate on table "public"."tags" from "anon";

revoke update on table "public"."tags" from "anon";

revoke delete on table "public"."tags" from "authenticated";

revoke insert on table "public"."tags" from "authenticated";

revoke references on table "public"."tags" from "authenticated";

revoke select on table "public"."tags" from "authenticated";

revoke trigger on table "public"."tags" from "authenticated";

revoke truncate on table "public"."tags" from "authenticated";

revoke update on table "public"."tags" from "authenticated";

revoke delete on table "public"."tags" from "service_role";

revoke insert on table "public"."tags" from "service_role";

revoke references on table "public"."tags" from "service_role";

revoke select on table "public"."tags" from "service_role";

revoke trigger on table "public"."tags" from "service_role";

revoke truncate on table "public"."tags" from "service_role";

revoke update on table "public"."tags" from "service_role";

revoke delete on table "public"."theme_evidence" from "anon";

revoke insert on table "public"."theme_evidence" from "anon";

revoke references on table "public"."theme_evidence" from "anon";

revoke select on table "public"."theme_evidence" from "anon";

revoke trigger on table "public"."theme_evidence" from "anon";

revoke truncate on table "public"."theme_evidence" from "anon";

revoke update on table "public"."theme_evidence" from "anon";

revoke delete on table "public"."theme_evidence" from "authenticated";

revoke insert on table "public"."theme_evidence" from "authenticated";

revoke references on table "public"."theme_evidence" from "authenticated";

revoke select on table "public"."theme_evidence" from "authenticated";

revoke trigger on table "public"."theme_evidence" from "authenticated";

revoke truncate on table "public"."theme_evidence" from "authenticated";

revoke update on table "public"."theme_evidence" from "authenticated";

revoke delete on table "public"."theme_evidence" from "service_role";

revoke insert on table "public"."theme_evidence" from "service_role";

revoke references on table "public"."theme_evidence" from "service_role";

revoke select on table "public"."theme_evidence" from "service_role";

revoke trigger on table "public"."theme_evidence" from "service_role";

revoke truncate on table "public"."theme_evidence" from "service_role";

revoke update on table "public"."theme_evidence" from "service_role";

revoke delete on table "public"."themes" from "anon";

revoke insert on table "public"."themes" from "anon";

revoke references on table "public"."themes" from "anon";

revoke select on table "public"."themes" from "anon";

revoke trigger on table "public"."themes" from "anon";

revoke truncate on table "public"."themes" from "anon";

revoke update on table "public"."themes" from "anon";

revoke delete on table "public"."themes" from "authenticated";

revoke insert on table "public"."themes" from "authenticated";

revoke references on table "public"."themes" from "authenticated";

revoke select on table "public"."themes" from "authenticated";

revoke trigger on table "public"."themes" from "authenticated";

revoke truncate on table "public"."themes" from "authenticated";

revoke update on table "public"."themes" from "authenticated";

revoke delete on table "public"."themes" from "service_role";

revoke insert on table "public"."themes" from "service_role";

revoke references on table "public"."themes" from "service_role";

revoke select on table "public"."themes" from "service_role";

revoke trigger on table "public"."themes" from "service_role";

revoke truncate on table "public"."themes" from "service_role";

revoke update on table "public"."themes" from "service_role";

revoke delete on table "public"."upload_jobs" from "anon";

revoke insert on table "public"."upload_jobs" from "anon";

revoke references on table "public"."upload_jobs" from "anon";

revoke select on table "public"."upload_jobs" from "anon";

revoke trigger on table "public"."upload_jobs" from "anon";

revoke truncate on table "public"."upload_jobs" from "anon";

revoke update on table "public"."upload_jobs" from "anon";

revoke delete on table "public"."upload_jobs" from "authenticated";

revoke insert on table "public"."upload_jobs" from "authenticated";

revoke references on table "public"."upload_jobs" from "authenticated";

revoke select on table "public"."upload_jobs" from "authenticated";

revoke trigger on table "public"."upload_jobs" from "authenticated";

revoke truncate on table "public"."upload_jobs" from "authenticated";

revoke update on table "public"."upload_jobs" from "authenticated";

revoke delete on table "public"."upload_jobs" from "service_role";

revoke insert on table "public"."upload_jobs" from "service_role";

revoke references on table "public"."upload_jobs" from "service_role";

revoke select on table "public"."upload_jobs" from "service_role";

revoke trigger on table "public"."upload_jobs" from "service_role";

revoke truncate on table "public"."upload_jobs" from "service_role";

revoke update on table "public"."upload_jobs" from "service_role";

revoke delete on table "public"."user_settings" from "anon";

revoke insert on table "public"."user_settings" from "anon";

revoke references on table "public"."user_settings" from "anon";

revoke select on table "public"."user_settings" from "anon";

revoke trigger on table "public"."user_settings" from "anon";

revoke truncate on table "public"."user_settings" from "anon";

revoke update on table "public"."user_settings" from "anon";

revoke delete on table "public"."user_settings" from "authenticated";

revoke insert on table "public"."user_settings" from "authenticated";

revoke references on table "public"."user_settings" from "authenticated";

revoke select on table "public"."user_settings" from "authenticated";

revoke trigger on table "public"."user_settings" from "authenticated";

revoke truncate on table "public"."user_settings" from "authenticated";

revoke update on table "public"."user_settings" from "authenticated";

revoke delete on table "public"."user_settings" from "service_role";

revoke insert on table "public"."user_settings" from "service_role";

revoke references on table "public"."user_settings" from "service_role";

revoke select on table "public"."user_settings" from "service_role";

revoke trigger on table "public"."user_settings" from "service_role";

revoke truncate on table "public"."user_settings" from "service_role";

revoke update on table "public"."user_settings" from "service_role";

revoke delete on table "public"."votes" from "anon";

revoke insert on table "public"."votes" from "anon";

revoke references on table "public"."votes" from "anon";

revoke select on table "public"."votes" from "anon";

revoke trigger on table "public"."votes" from "anon";

revoke truncate on table "public"."votes" from "anon";

revoke update on table "public"."votes" from "anon";

revoke delete on table "public"."votes" from "authenticated";

revoke insert on table "public"."votes" from "authenticated";

revoke references on table "public"."votes" from "authenticated";

revoke select on table "public"."votes" from "authenticated";

revoke trigger on table "public"."votes" from "authenticated";

revoke truncate on table "public"."votes" from "authenticated";

revoke update on table "public"."votes" from "authenticated";

revoke delete on table "public"."votes" from "service_role";

revoke insert on table "public"."votes" from "service_role";

revoke references on table "public"."votes" from "service_role";

revoke select on table "public"."votes" from "service_role";

revoke trigger on table "public"."votes" from "service_role";

revoke truncate on table "public"."votes" from "service_role";

revoke update on table "public"."votes" from "service_role";

alter table "public"."actions" drop constraint "actions_insight_id_fkey";

alter table "public"."comments" drop constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" drop constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" drop constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" drop constraint "persona_insights_insight_id_fkey";

drop view if exists "public"."insights_with_priority";

drop view if exists "public"."insights_current";

create table "public"."mastra_ai_spans" (
    "traceId" text not null,
    "spanId" text not null,
    "parentSpanId" text,
    "name" text not null,
    "scope" jsonb,
    "spanType" text not null,
    "attributes" jsonb,
    "metadata" jsonb,
    "links" jsonb,
    "input" jsonb,
    "output" jsonb,
    "error" jsonb,
    "startedAt" timestamp without time zone not null,
    "endedAt" timestamp without time zone,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone,
    "isEvent" boolean not null,
    "startedAtZ" timestamp with time zone default now(),
    "endedAtZ" timestamp with time zone default now(),
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
);


create table "public"."mastra_evals" (
    "input" text not null,
    "output" text not null,
    "result" jsonb not null,
    "agent_name" text not null,
    "metric_name" text not null,
    "instructions" text not null,
    "test_info" jsonb,
    "global_run_id" text not null,
    "run_id" text not null,
    "created_at" timestamp without time zone not null,
    "createdAt" timestamp without time zone,
    "created_atZ" timestamp with time zone default now(),
    "createdAtZ" timestamp with time zone default now()
);


create table "public"."mastra_messages" (
    "id" text not null,
    "thread_id" text not null,
    "content" text not null,
    "role" text not null,
    "type" text not null,
    "createdAt" timestamp without time zone not null,
    "resourceId" text,
    "createdAtZ" timestamp with time zone default now()
);


create table "public"."mastra_resources" (
    "id" text not null,
    "workingMemory" text,
    "metadata" jsonb,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
);


create table "public"."mastra_scorers" (
    "id" text not null,
    "scorerId" text not null,
    "traceId" text,
    "runId" text not null,
    "scorer" jsonb not null,
    "preprocessStepResult" jsonb,
    "extractStepResult" jsonb,
    "analyzeStepResult" jsonb,
    "score" double precision not null,
    "reason" text,
    "metadata" jsonb,
    "preprocessPrompt" text,
    "extractPrompt" text,
    "generateScorePrompt" text,
    "generateReasonPrompt" text,
    "analyzePrompt" text,
    "reasonPrompt" text,
    "input" jsonb not null,
    "output" jsonb not null,
    "additionalContext" jsonb,
    "runtimeContext" jsonb,
    "entityType" text,
    "entity" jsonb,
    "entityId" text,
    "source" text not null,
    "resourceId" text,
    "threadId" text,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now(),
    "spanId" text
);


create table "public"."mastra_threads" (
    "id" text not null,
    "resourceId" text not null,
    "title" text not null,
    "metadata" text,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
);


create table "public"."mastra_traces" (
    "id" text not null,
    "parentSpanId" text,
    "name" text not null,
    "traceId" text not null,
    "scope" text not null,
    "kind" integer not null,
    "attributes" jsonb,
    "status" jsonb,
    "events" jsonb,
    "links" jsonb,
    "other" text,
    "startTime" bigint not null,
    "endTime" bigint not null,
    "createdAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now()
);


create table "public"."mastra_workflow_snapshot" (
    "workflow_name" text not null,
    "run_id" text not null,
    "resourceId" text,
    "snapshot" text not null,
    "createdAt" timestamp without time zone not null,
    "updatedAt" timestamp without time zone not null,
    "createdAtZ" timestamp with time zone default now(),
    "updatedAtZ" timestamp with time zone default now()
);


alter table "public"."themes" drop column "category";

alter table "public"."themes" drop column "confidence";

alter table "public"."themes" drop column "contradictions";

alter table "public"."themes" drop column "desired_outcome";

alter table "public"."themes" drop column "details";

alter table "public"."themes" drop column "emotional_response";

alter table "public"."themes" drop column "evidence";

alter table "public"."themes" drop column "impact";

alter table "public"."themes" drop column "interview_id";

alter table "public"."themes" drop column "journey_stage";

alter table "public"."themes" drop column "jtbd";

alter table "public"."themes" drop column "motivation";

alter table "public"."themes" drop column "novelty";

alter table "public"."themes" drop column "opportunity_ideas";

alter table "public"."themes" drop column "pain";

alter table "public"."themes" drop column "related_tags";

CREATE UNIQUE INDEX mastra_messages_pkey ON public.mastra_messages USING btree (id);

CREATE UNIQUE INDEX mastra_resources_pkey ON public.mastra_resources USING btree (id);

CREATE UNIQUE INDEX mastra_scorers_pkey ON public.mastra_scorers USING btree (id);

CREATE UNIQUE INDEX mastra_threads_pkey ON public.mastra_threads USING btree (id);

CREATE UNIQUE INDEX mastra_traces_pkey ON public.mastra_traces USING btree (id);

CREATE INDEX public_mastra_ai_spans_name_idx ON public.mastra_ai_spans USING btree (name);

CREATE INDEX public_mastra_ai_spans_parentspanid_startedat_idx ON public.mastra_ai_spans USING btree ("parentSpanId", "startedAt" DESC);

CREATE INDEX public_mastra_ai_spans_spantype_startedat_idx ON public.mastra_ai_spans USING btree ("spanType", "startedAt" DESC);

CREATE INDEX public_mastra_ai_spans_traceid_startedat_idx ON public.mastra_ai_spans USING btree ("traceId", "startedAt" DESC);

CREATE INDEX public_mastra_evals_agent_name_created_at_idx ON public.mastra_evals USING btree (agent_name, created_at DESC);

CREATE INDEX public_mastra_messages_thread_id_createdat_idx ON public.mastra_messages USING btree (thread_id, "createdAt" DESC);

CREATE INDEX public_mastra_scores_trace_id_span_id_created_at_idx ON public.mastra_scorers USING btree ("traceId", "spanId", "createdAt" DESC);

CREATE INDEX public_mastra_threads_resourceid_createdat_idx ON public.mastra_threads USING btree ("resourceId", "createdAt" DESC);

CREATE INDEX public_mastra_traces_name_starttime_idx ON public.mastra_traces USING btree (name, "startTime" DESC);

CREATE UNIQUE INDEX public_mastra_workflow_snapshot_workflow_name_run_id_key ON public.mastra_workflow_snapshot USING btree (workflow_name, run_id);

alter table "public"."mastra_messages" add constraint "mastra_messages_pkey" PRIMARY KEY using index "mastra_messages_pkey";

alter table "public"."mastra_resources" add constraint "mastra_resources_pkey" PRIMARY KEY using index "mastra_resources_pkey";

alter table "public"."mastra_scorers" add constraint "mastra_scorers_pkey" PRIMARY KEY using index "mastra_scorers_pkey";

alter table "public"."mastra_threads" add constraint "mastra_threads_pkey" PRIMARY KEY using index "mastra_threads_pkey";

alter table "public"."mastra_traces" add constraint "mastra_traces_pkey" PRIMARY KEY using index "mastra_traces_pkey";

alter table "public"."insights" add constraint "insights_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES interviews(id) not valid;

alter table "public"."insights" validate constraint "insights_interview_id_fkey";

alter table "public"."mastra_workflow_snapshot" add constraint "public_mastra_workflow_snapshot_workflow_name_run_id_key" UNIQUE using index "public_mastra_workflow_snapshot_workflow_name_run_id_key";

alter table "public"."actions" add constraint "actions_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES themes(id) ON DELETE SET NULL not valid;

alter table "public"."actions" validate constraint "actions_insight_id_fkey";

alter table "public"."comments" add constraint "comments_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_insight_id_fkey";

alter table "public"."insight_tags" add constraint "insight_tags_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES themes(id) ON DELETE CASCADE not valid;

alter table "public"."insight_tags" validate constraint "insight_tags_insight_id_fkey";

alter table "public"."opportunity_insights" add constraint "opportunity_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES themes(id) ON DELETE CASCADE not valid;

alter table "public"."opportunity_insights" validate constraint "opportunity_insights_insight_id_fkey";

alter table "public"."persona_insights" add constraint "persona_insights_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES themes(id) ON DELETE CASCADE not valid;

alter table "public"."persona_insights" validate constraint "persona_insights_insight_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                NEW."createdAt" = NOW();
                NEW."updatedAt" = NOW();
                NEW."createdAtZ" = NOW();
                NEW."updatedAtZ" = NOW();
            ELSIF TG_OP = 'UPDATE' THEN
                NEW."updatedAt" = NOW();
                NEW."updatedAtZ" = NOW();
                -- Prevent createdAt from being changed
                NEW."createdAt" = OLD."createdAt";
                NEW."createdAtZ" = OLD."createdAtZ";
            END IF;
            RETURN NEW;
        END;
        $function$
;

CREATE OR REPLACE FUNCTION public.accept_invitation(lookup_invitation_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
declare
    lookup_account_id       uuid;
    declare new_member_role accounts.account_role;
    lookup_account_slug     text;
begin
    select i.account_id, i.account_role, a.slug
    into lookup_account_id, new_member_role, lookup_account_slug
    from accounts.invitations i
             join accounts.accounts a on a.id = i.account_id
    where i.token = lookup_invitation_token
      and i.created_at > now() - interval '24 hours';

    if lookup_account_id IS NULL then
        raise exception 'Invitation not found';
    end if;

    if lookup_account_id is not null then
        -- we've validated the token is real, so grant the user access
        insert into accounts.account_user (account_id, user_id, account_role)
        values (lookup_account_id, auth.uid(), new_member_role);
        -- email types of invitations are only good for one usage
        delete from accounts.invitations where token = lookup_invitation_token and invitation_type = 'one_time';
    end if;
    return json_build_object('account_id', lookup_account_id, 'account_role', new_member_role, 'slug',
                             lookup_account_slug);
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'You are already a member of this account';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_link_persona_insights(p_insight_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    persona_record RECORD;
    relevance_score_var DECIMAL(3,2);
BEGIN
    -- Find personas for people involved in the interview that generated this insight
    FOR persona_record IN
        SELECT DISTINCT pp.persona_id, p.name as persona
        FROM themes i
        JOIN interviews iv ON i.interview_id = iv.id
        JOIN interview_people ip ON iv.id = ip.interview_id
        JOIN people pe ON ip.person_id = pe.id
        JOIN people_personas pp ON pe.id = pp.person_id
        JOIN personas p ON pp.persona_id = p.id AND pe.account_id = p.account_id
        WHERE i.id = p_insight_id
        AND pp.persona_id IS NOT NULL
    LOOP
        -- Calculate relevance score (simplified - could be more sophisticated)
        relevance_score_var := 1.0;

        -- Insert persona-insight link
        INSERT INTO persona_insights (persona_id, insight_id, relevance_score, created_at)
        VALUES (persona_record.persona_id, p_insight_id, relevance_score_var, NOW())
        ON CONFLICT (persona_id, insight_id) DO NOTHING;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_account(slug text DEFAULT NULL::text, name text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    new_account_id uuid;
BEGIN
    insert into accounts.accounts (slug, name)
    values (create_account.slug, create_account.name)
    returning id into new_account_id;

    return public.get_account(new_account_id);
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'An account with that unique ID already exists';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_account_id(primary_owner_user_id uuid DEFAULT NULL::uuid, slug text DEFAULT NULL::text, name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    new_account_id uuid;
BEGIN
    insert into accounts.accounts (primary_owner_user_id, slug, name)
    values (primary_owner_user_id, slug, name)
    returning id into new_account_id;

    return new_account_id;
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'An account with that unique ID already exists';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_invitation(account_id uuid, account_role accounts.account_role, invitation_type accounts.invitation_type, invitee_email text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_invitation accounts.invitations;
BEGIN
  INSERT INTO accounts.invitations (account_id, account_role, invitation_type, invited_by_user_id, invitee_email)
  VALUES (account_id, account_role, invitation_type, auth.uid(), invitee_email)
  RETURNING * INTO new_invitation;

  RETURN json_build_object('token', new_invitation.token);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_account_role(p_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    response jsonb;
BEGIN

    select jsonb_build_object(
                   'account_role', wu.account_role,
                   'is_primary_owner', a.primary_owner_user_id = auth.uid(),
                   'is_personal_account', a.personal_account
               )
    into response
    from accounts.account_user wu
             join accounts.accounts a on a.id = wu.account_id
    where wu.user_id = auth.uid()
      and wu.account_id = p_account_id;

    -- if the user is not a member of the account, throw an error
    if response ->> 'account_role' IS NULL then
        raise exception 'Not found';
    end if;

    return response;
END
$function$
;

CREATE OR REPLACE FUNCTION public.delete_invitation(invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
    -- verify account owner for the invitation
    if accounts.has_role_on_account(
               (select account_id from accounts.invitations where id = delete_invitation.invitation_id), 'owner') <>
       true then
        raise exception 'Only account owners can delete invitations';
    end if;

    delete from accounts.invitations where id = delete_invitation.invitation_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_facet_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.label is distinct from new.label)) then
    perform pgmq.send(
      'facet_embedding_queue',
      json_build_object(
        'facet_id', new.id::text,
        'label', new.label,
        'kind_slug', new.kind_slug
      )::jsonb
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_insight_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.pain is distinct from new.pain)) then
    perform pgmq.send(
      'insights_embedding_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'name',  new.name,
        'pain',  new.pain
      )::jsonb
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_person_facet_embedding()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  facet_label text;
  kind_slug text;
begin
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    -- Fetch label and kind_slug from facet_account via join
    select fa.label, fkg.slug
    into facet_label, kind_slug
    from facet_account fa
    join facet_kind_global fkg on fkg.id = fa.kind_id
    where fa.id = new.facet_account_id;

    if facet_label is not null then
      perform pgmq.send(
        'person_facet_embedding_queue',
        json_build_object(
          'person_id', new.person_id::text,
          'facet_account_id', new.facet_account_id,
          'label', facet_label,
          'kind_slug', kind_slug
        )::jsonb
      );
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_transcribe_interview()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.media_url is distinct from new.media_url)) then
    perform pgmq.send(
      'transcribe_interview_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'media_url',  new.media_url
      )::jsonb
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_duplicate_themes(project_id_param uuid, similarity_threshold double precision DEFAULT 0.85)
 RETURNS TABLE(theme_id_1 uuid, theme_id_2 uuid, theme_name_1 text, theme_name_2 text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      t1.id as theme_id_1,
      t2.id as theme_id_2,
      t1.name as theme_name_1,
      t2.name as theme_name_2,
      1 - (t1.embedding <=> t2.embedding) as similarity
    from public.themes t1
    cross join public.themes t2
    where t1.project_id = project_id_param
      and t2.project_id = project_id_param
      and t1.id < t2.id  -- Avoid duplicates and self-matches
      and t1.embedding is not null
      and t2.embedding is not null
      and 1 - (t1.embedding <=> t2.embedding) > similarity_threshold
    order by similarity desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_person_facet_clusters(project_id_param uuid, kind_slug_param text, similarity_threshold double precision DEFAULT 0.75)
 RETURNS TABLE(person_facet_id_1 text, person_facet_id_2 text, facet_account_id_1 integer, facet_account_id_2 integer, label_1 text, label_2 text, similarity double precision, combined_person_count bigint)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      pf1.person_id::text || '|' || pf1.facet_account_id::text as person_facet_id_1,
      pf2.person_id::text || '|' || pf2.facet_account_id::text as person_facet_id_2,
      pf1.facet_account_id as facet_account_id_1,
      pf2.facet_account_id as facet_account_id_2,
      fa1.label as label_1,
      fa2.label as label_2,
      1 - (pf1.embedding <=> pf2.embedding) as similarity,
      (
        select count(distinct person_id)
        from public.person_facet pf_temp
        where pf_temp.facet_account_id in (pf1.facet_account_id, pf2.facet_account_id)
          and pf_temp.project_id = project_id_param
      ) as combined_person_count
    from public.person_facet pf1
    join public.facet_account fa1 on fa1.id = pf1.facet_account_id
    join public.facet_kind_global fkg1 on fkg1.id = fa1.kind_id
    cross join public.person_facet pf2
    join public.facet_account fa2 on fa2.id = pf2.facet_account_id
    join public.facet_kind_global fkg2 on fkg2.id = fa2.kind_id
    where pf1.project_id = project_id_param
      and pf2.project_id = project_id_param
      and fkg1.slug = kind_slug_param
      and fkg2.slug = kind_slug_param
      and pf1.facet_account_id < pf2.facet_account_id  -- Avoid duplicates and self-matches
      and pf1.embedding is not null
      and pf2.embedding is not null
      and 1 - (pf1.embedding <=> pf2.embedding) > similarity_threshold
    order by similarity desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_similar_evidence(query_embedding vector, project_id_param uuid, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, verbatim text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      evidence.id,
      evidence.verbatim,
      1 - (evidence.embedding <=> query_embedding) as similarity
    from public.evidence
    where evidence.project_id = project_id_param
      and evidence.embedding is not null
      and 1 - (evidence.embedding <=> query_embedding) > match_threshold
    order by evidence.embedding <=> query_embedding
    limit match_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_similar_themes(query_embedding vector, project_id_param uuid, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, name text, statement text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
    select
      themes.id,
      themes.name,
      themes.statement,
      1 - (themes.embedding <=> query_embedding) as similarity
    from public.themes
    where themes.project_id = project_id_param
      and themes.embedding is not null
      and 1 - (themes.embedding <=> query_embedding) > match_threshold
    order by themes.embedding <=> query_embedding
    limit match_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account(account_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
declare
    user_id uuid;
    user_role text;
begin
    -- Get the current user's id from the JWT/session
    user_id := auth.uid();

    -- Check if the user is a member of the account
    select au.account_role into user_role
    from accounts.account_user au
    where au.account_id = get_account.account_id and au.user_id = auth.uid()
    limit 1;

    if user_role is null then
        raise exception 'You must be a member of an account to access it';
    end if;

    -- Return the account data
    return (
        select json_build_object(
            'account_id', a.id,
            'account_role', user_role,
            'is_primary_owner', a.primary_owner_user_id = auth.uid(),
            'name', a.name,
            'slug', a.slug,
            'personal_account', a.personal_account,
            'billing_enabled', case
                when a.personal_account = true then config.enable_personal_account_billing
                else config.enable_team_account_billing
            end,
            'billing_status', bs.status,
            'created_at', a.created_at,
            'updated_at', a.updated_at,
            'metadata', a.public_metadata
        )
        from accounts.accounts a
        join accounts.config config on true
        left join (
            select bs.account_id, bs.status
            from accounts.billing_subscriptions bs
            where bs.account_id = get_account.account_id
            order by bs.created desc
            limit 1
        ) bs on bs.account_id = a.id
        where a.id = get_account.account_id
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_billing_status(account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
DECLARE
    result      jsonb;
    role_result jsonb;
BEGIN
    select public.current_user_account_role(get_account_billing_status.account_id) into role_result;

    select jsonb_build_object(
                   'account_id', get_account_billing_status.account_id,
                   'billing_subscription_id', s.id,
                   'billing_enabled', case
                                          when a.personal_account = true then config.enable_personal_account_billing
                                          else config.enable_team_account_billing end,
                   'billing_status', s.status,
                   'billing_customer_id', c.id,
                   'billing_provider', config.billing_provider,
                   'billing_email',
                   coalesce(c.email, u.email) -- if we don't have a customer email, use the user's email as a fallback
               )
    into result
    from accounts.accounts a
             join auth.users u on u.id = a.primary_owner_user_id
             left join accounts.billing_subscriptions s on s.account_id = a.id
             left join accounts.billing_customers c on c.account_id = coalesce(s.account_id, a.id)
             join accounts.config config on true
    where a.id = get_account_billing_status.account_id
    order by s.created desc
    limit 1;

    return result || role_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_by_slug(slug text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    internal_account_id uuid;
BEGIN
    select a.id
    into internal_account_id
    from accounts.accounts a
    where a.slug IS NOT NULL
      and a.slug = get_account_by_slug.slug;

    return public.get_account(internal_account_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_id(slug text)
 RETURNS uuid
 LANGUAGE sql
AS $function$
select id
from accounts.accounts
where slug = get_account_id.slug;
$function$
;

CREATE OR REPLACE FUNCTION public.get_account_invitations(account_id uuid, results_limit integer DEFAULT 25, results_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
AS $function$BEGIN
    -- only account owners can access this function
    if (select public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role' <> 'owner') then
        raise exception 'Only account owners can access this function';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'account_role', i.account_role,
                                   'created_at', i.created_at,
                                   'invitation_type', i.invitation_type,
                                   'invitation_id', i.id,
                                   'email', i.invitee_email
                               )
                       )
            from accounts.invitations i
            where i.account_id = get_account_invitations.account_id
              and i.created_at > now() - interval '24 hours'
            limit coalesce(get_account_invitations.results_limit, 25) offset coalesce(get_account_invitations.results_offset, 0));
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_account_members(account_id uuid, results_limit integer DEFAULT 50, results_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'accounts'
AS $function$
BEGIN

    -- only account owners can access this function
    if (select public.current_user_account_role(get_account_members.account_id) ->> 'account_role' <> 'owner') then
        raise exception 'Only account owners can access this function';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'user_id', wu.user_id,
                                   'account_role', wu.account_role,
                                   'name', p.name,
                                   'email', u.email,
                                   'is_primary_owner', a.primary_owner_user_id = wu.user_id
                               )
                       )
            from accounts.account_user wu
                     join accounts.accounts a on a.id = wu.account_id
                     join accounts.accounts p on p.primary_owner_user_id = wu.user_id and p.personal_account = true
                     join auth.users u on u.id = wu.user_id
            where wu.account_id = get_account_members.account_id
            limit coalesce(get_account_members.results_limit, 50) offset coalesce(get_account_members.results_offset, 0));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_accounts()
 RETURNS json
 LANGUAGE sql
AS $function$
select coalesce(json_agg(
                        json_build_object(
                                'account_id', wu.account_id,
                                'account_role', wu.account_role,
                                'is_primary_owner', a.primary_owner_user_id = auth.uid(),
                                'name', a.name,
                                'slug', a.slug,
                                'personal_account', a.personal_account,
                                'created_at', a.created_at,
                                'updated_at', a.updated_at
                            )
                    ), '[]'::json)
from accounts.account_user wu
         join accounts.accounts a on a.id = wu.account_id
where wu.user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_annotation_counts(p_entity_type text, p_entity_id uuid, p_project_id uuid)
 RETURNS TABLE(annotation_type text, count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    a.annotation_type,
    COUNT(*) as count
  FROM public.annotations a
  WHERE a.entity_type = p_entity_type
    AND a.entity_id = p_entity_id
    AND a.project_id = p_project_id
    AND a.status = 'active'
  GROUP BY a.annotation_type;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_personal_account()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    return public.get_account(auth.uid());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_accounts()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'account_id', au.account_id,
        'account_role', au.account_role,
        'is_primary_owner', a.primary_owner_user_id = auth.uid(),
        'name', a.name,
        'slug', a.slug,
        'personal_account', a.personal_account,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'projects', COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', p.id,
              'account_id', p.account_id,
              'name', p.name,
              'description', p.description,
              'status', p.status,
							'slug', p.slug,
              'created_at', p.created_at,
              'updated_at', p.updated_at
            )
          )
          FROM public.projects p
          WHERE p.account_id = au.account_id
          ), '[]'::json
        )
      )
    ),
    '[]'::json
  )
  FROM accounts.account_user au
  JOIN accounts.accounts a ON a.id = au.account_id
  WHERE au.user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_flags(p_entity_type text, p_entity_id uuid, p_project_id uuid)
 RETURNS TABLE(flag_type text, flag_value boolean, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ef.flag_type,
    ef.flag_value,
    ef.metadata
  FROM public.entity_flags ef
  WHERE ef.entity_type = p_entity_type
    AND ef.entity_id = p_entity_id
    AND ef.project_id = p_project_id
    AND ef.user_id = auth.uid();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_vote(p_entity_type text, p_entity_id uuid, p_project_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  user_vote INTEGER;
BEGIN
  SELECT vote_value INTO user_vote
  FROM public.votes
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND project_id = p_project_id
    AND user_id = auth.uid();

  RETURN COALESCE(user_vote, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_vote_counts(p_entity_type text, p_entity_id uuid, p_project_id uuid)
 RETURNS TABLE(upvotes bigint, downvotes bigint, total_votes bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN v.vote_value = 1 THEN 1 ELSE 0 END), 0) as upvotes,
    COALESCE(SUM(CASE WHEN v.vote_value = -1 THEN 1 ELSE 0 END), 0) as downvotes,
    COUNT(*) as total_votes
  FROM public.votes v
  WHERE v.entity_type = p_entity_type
    AND v.entity_id = p_entity_id
    AND v.project_id = p_project_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invoke_edge_function(func_name text, payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  req_id bigint;
  supabase_anon_key text;
begin
  select decrypted_secret
  into supabase_anon_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_ANON_KEY'
  order by created_at desc
  limit 1;

  req_id := net.http_post(
    format('https://rbginqvgkonnoktrttqv.functions.supabase.co/%s', func_name),
    payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Authorization', 'Bearer ' || supabase_anon_key,
      'Content-Type', 'application/json'
    ),
    15000  -- timeout in milliseconds
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_invitations_for_current_user()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
DECLARE
  current_email text;
BEGIN
  -- Determine current user's email
  SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
  IF current_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'account_id', i.account_id,
          'account_name', i.account_name,
          'account_role', i.account_role,
          'invitation_type', i.invitation_type,
          'created_at', i.created_at,
          'token', i.token
        )
        ORDER BY i.created_at DESC
      ), '[]'::json
    )
    FROM accounts.invitations i
    WHERE i.invitee_email IS NOT NULL
      AND lower(i.invitee_email) = lower(current_email)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.lookup_invitation(lookup_invitation_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'accounts'
AS $function$
declare
    name              text;
    invitation_active boolean;
begin
    select account_name,
           case when id IS NOT NULL then true else false end as active
    into name, invitation_active
    from accounts.invitations
    where token = lookup_invitation_token
      and created_at > now() - interval '24 hours'
    limit 1;
    return json_build_object('active', coalesce(invitation_active, false), 'account_name', name);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_embedding_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'insights_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed', job.message::jsonb);
    perform pgmq.delete(
      'insights_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s message(s) from embedding queue.', count);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_facet_embedding_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'facet_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed-facet', job.message::jsonb);
    perform pgmq.delete(
      'facet_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s facet message(s) from embedding queue.', count);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_person_facet_embedding_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'person_facet_embedding_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('embed-person-facet', job.message::jsonb);
    perform pgmq.delete(
      'person_facet_embedding_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s person facet message(s) from embedding queue.', count);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_transcribe_queue()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'transcribe_interview_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('transcribe', job.message::jsonb);
    perform pgmq.delete(
      'transcribe_interview_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s message(s) from transcribe queue.', count);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_account_member(account_id uuid, user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- only account owners can access this function
    if accounts.has_role_on_account(remove_account_member.account_id, 'owner') <> true then
        raise exception 'Only account owners can access this function';
    end if;

    delete
    from accounts.account_user wu
    where wu.account_id = remove_account_member.account_id
      and wu.user_id = remove_account_member.user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.service_role_upsert_customer_subscription(account_id uuid, customer jsonb DEFAULT NULL::jsonb, subscription jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- if the customer is not null, upsert the data into billing_customers, only upsert fields that are present in the jsonb object
    if customer is not null then
        insert into accounts.billing_customers (id, account_id, email, provider)
        values (customer ->> 'id', service_role_upsert_customer_subscription.account_id, customer ->> 'billing_email',
                (customer ->> 'provider'))
        on conflict (id) do update
            set email = customer ->> 'billing_email';
    end if;

    -- if the subscription is not null, upsert the data into billing_subscriptions, only upsert fields that are present in the jsonb object
    if subscription is not null then
        insert into accounts.billing_subscriptions (id, account_id, billing_customer_id, status, metadata, price_id,
                                                    quantity, cancel_at_period_end, created, current_period_start,
                                                    current_period_end, ended_at, cancel_at, canceled_at, trial_start,
                                                    trial_end, plan_name, provider)
        values (subscription ->> 'id', service_role_upsert_customer_subscription.account_id,
                subscription ->> 'billing_customer_id', (subscription ->> 'status')::accounts.subscription_status,
                subscription -> 'metadata',
                subscription ->> 'price_id', (subscription ->> 'quantity')::int,
                (subscription ->> 'cancel_at_period_end')::boolean,
                (subscription ->> 'created')::timestamptz, (subscription ->> 'current_period_start')::timestamptz,
                (subscription ->> 'current_period_end')::timestamptz, (subscription ->> 'ended_at')::timestamptz,
                (subscription ->> 'cancel_at')::timestamptz,
                (subscription ->> 'canceled_at')::timestamptz, (subscription ->> 'trial_start')::timestamptz,
                (subscription ->> 'trial_end')::timestamptz,
                subscription ->> 'plan_name', (subscription ->> 'provider'))
        on conflict (id) do update
            set billing_customer_id  = subscription ->> 'billing_customer_id',
                status               = (subscription ->> 'status')::accounts.subscription_status,
                metadata             = subscription -> 'metadata',
                price_id             = subscription ->> 'price_id',
                quantity             = (subscription ->> 'quantity')::int,
                cancel_at_period_end = (subscription ->> 'cancel_at_period_end')::boolean,
                current_period_start = (subscription ->> 'current_period_start')::timestamptz,
                current_period_end   = (subscription ->> 'current_period_end')::timestamptz,
                ended_at             = (subscription ->> 'ended_at')::timestamptz,
                cancel_at            = (subscription ->> 'cancel_at')::timestamptz,
                canceled_at          = (subscription ->> 'canceled_at')::timestamptz,
                trial_start          = (subscription ->> 'trial_start')::timestamptz,
                trial_end            = (subscription ->> 'trial_end')::timestamptz,
                plan_name            = subscription ->> 'plan_name';
    end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_current_account_id(new_account_id uuid)
 RETURNS account_settings
 LANGUAGE plpgsql
AS $function$
declare
  updated_row public.account_settings;
begin
  update public.account_settings
  set current_account_id = new_account_id
  where user_id = auth.uid()
  returning * into updated_row;
  return updated_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.slugify_project_name()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name IS DISTINCT FROM OLD.name THEN
    -- 1a) replace non-alnum/dash → dash
    -- 1b) collapse multiple dashes → one
    -- 1c) trim dashes off ends
    -- 1d) lowercase
    NEW.slug := lower(
      trim(both '-' FROM
        regexp_replace(
          regexp_replace(NEW.name, '[^A-Za-z0-9-]+', '-', 'g'),
        '-+', '-', 'g')
      )
    );
  END IF;
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.sync_insight_tags(p_insight_id uuid, p_tag_names text[], p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    tag_record RECORD;
    tag_id_var UUID;
BEGIN
    -- Remove existing tags for this insight
    DELETE FROM insight_tags WHERE insight_id = p_insight_id;

    -- Add new tags
    IF p_tag_names IS NOT NULL AND array_length(p_tag_names, 1) > 0 THEN
        FOREACH tag_record.tag IN ARRAY p_tag_names LOOP
            -- Find or create the tag
            SELECT account_id, tag INTO tag_id_var
            FROM tags
            WHERE account_id = p_account_id AND tag = tag_record.tag;

            -- If tag doesn't exist, create it
            IF NOT FOUND THEN
                INSERT INTO tags (account_id, tag, created_at)
                VALUES (p_account_id, tag_record.tag, NOW());
                tag_id_var := p_account_id || tag_record.tag; -- Composite key reference
            END IF;

            -- Insert junction record
            INSERT INTO insight_tags (insight_id, tag_id, created_at)
            VALUES (p_insight_id, tag_id_var, NOW())
            ON CONFLICT (insight_id, tag_id) DO NOTHING;
        END LOOP;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_opportunity_insights(p_opportunity_id uuid, p_insight_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Remove existing insights for this opportunity
    DELETE FROM opportunity_insights WHERE opportunity_id = p_opportunity_id;

    -- Add new insights
    IF p_insight_ids IS NOT NULL AND array_length(p_insight_ids, 1) > 0 THEN
        INSERT INTO opportunity_insights (opportunity_id, insight_id, created_at)
        SELECT p_opportunity_id, unnest(p_insight_ids), NOW()
        ON CONFLICT (opportunity_id, insight_id) DO NOTHING;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_auto_link_persona_insights()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM auto_link_persona_insights(NEW.id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_project_people()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Use project_id from interview_people table (can also query interview if needed)
        PERFORM update_project_people_stats(
            COALESCE(NEW.project_id, (SELECT project_id FROM interviews WHERE id = NEW.interview_id)),
            NEW.person_id
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- CRITICAL: Silently ignore FK violations during CASCADE DELETE
        -- When a person is being deleted, interview_people CASCADE deletes trigger this,
        -- but we can't update project_people because the person is gone
        BEGIN
            IF OLD.project_id IS NOT NULL THEN
                PERFORM update_project_people_stats(
                    OLD.project_id,
                    OLD.person_id
                );
            END IF;
        EXCEPTION
            WHEN foreign_key_violation THEN
                -- Silently ignore - person is being cascade deleted
                NULL;
        END;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_account(account_id uuid, slug text DEFAULT NULL::text, name text DEFAULT NULL::text, public_metadata jsonb DEFAULT NULL::jsonb, replace_metadata boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN

    -- check if postgres role is service_role
    if current_user IN ('anon', 'authenticated') and
       not (select current_user_account_role(update_account.account_id) ->> 'account_role' = 'owner') then
        raise exception 'Only account owners can update an account';
    end if;

    update accounts.accounts accounts
    set slug            = coalesce(update_account.slug, accounts.slug),
        name            = coalesce(update_account.name, accounts.name),
        public_metadata = case
                              when update_account.public_metadata is null then accounts.public_metadata -- do nothing
                              when accounts.public_metadata IS NULL then update_account.public_metadata -- set metadata
                              when update_account.replace_metadata
                                  then update_account.public_metadata -- replace metadata
                              else accounts.public_metadata || update_account.public_metadata end -- merge metadata
    where accounts.id = update_account.account_id;

    return public.get_account(account_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_account_user_role(account_id uuid, user_id uuid, new_account_role accounts.account_role, make_primary_owner boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    is_account_owner         boolean;
    is_account_primary_owner boolean;
    changing_primary_owner   boolean;
begin
    -- check if the user is an owner, and if they are, allow them to update the role
    select accounts.has_role_on_account(update_account_user_role.account_id, 'owner') into is_account_owner;

    if not is_account_owner then
        raise exception 'You must be an owner of the account to update a users role';
    end if;

    -- check if the user being changed is the primary owner, if so its not allowed
    select primary_owner_user_id = auth.uid(), primary_owner_user_id = update_account_user_role.user_id
    into is_account_primary_owner, changing_primary_owner
    from accounts.accounts
    where id = update_account_user_role.account_id;

    if changing_primary_owner = true and is_account_primary_owner = false then
        raise exception 'You must be the primary owner of the account to change the primary owner';
    end if;

    update accounts.account_user au
    set account_role = new_account_role
    where au.account_id = update_account_user_role.account_id
      and au.user_id = update_account_user_role.user_id;

    if make_primary_owner = true then
        -- first we see if the current user is the owner, only they can do this
        if is_account_primary_owner = false then
            raise exception 'You must be the primary owner of the account to change the primary owner';
        end if;

        update accounts.accounts
        set primary_owner_user_id = update_account_user_role.user_id
        where id = update_account_user_role.account_id;
    end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_icp_recommendations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_project_people_stats(p_project_id uuid, p_person_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    interview_count_var INTEGER;
    first_interview_date TIMESTAMPTZ;
    last_interview_date TIMESTAMPTZ;
BEGIN
    -- Calculate stats for this person in this project
    SELECT
        COUNT(*),
        MIN(i.interview_date),
        MAX(i.interview_date)
    INTO
        interview_count_var,
        first_interview_date,
        last_interview_date
    FROM interviews i
    JOIN interview_people ip ON i.id = ip.interview_id
    WHERE i.project_id = p_project_id
    AND ip.person_id = p_person_id;

    -- Update or insert project_people record
    INSERT INTO project_people (
        project_id,
        person_id,
        interview_count,
        first_seen_at,
        last_seen_at,
        created_at,
        updated_at
    )
    VALUES (
        p_project_id,
        p_person_id,
        COALESCE(interview_count_var, 0),
        COALESCE(first_interview_date, NOW()),
        COALESCE(last_interview_date, NOW()),
        NOW(),
        NOW()
    )
    ON CONFLICT (project_id, person_id)
    DO UPDATE SET
        interview_count = COALESCE(interview_count_var, 0),
        first_seen_at = COALESCE(first_interview_date, project_people.first_seen_at),
        last_seen_at = COALESCE(last_interview_date, project_people.last_seen_at),
        updated_at = NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_signup_data(p_user_id uuid, p_signup_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
    -- Insert or update user_settings with signup_data
    insert into user_settings (user_id, signup_data)
    values (p_user_id, p_signup_data)
    on conflict (user_id) 
    do update set 
        signup_data = coalesce(user_settings.signup_data, '{}'::jsonb) || excluded.signup_data,
        updated_at = now();
end;
$function$
;

CREATE TRIGGER mastra_ai_spans_timestamps BEFORE INSERT OR UPDATE ON public.mastra_ai_spans FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamps();


revoke delete on table "accounts"."account_user" from "authenticated";

revoke insert on table "accounts"."account_user" from "authenticated";

revoke select on table "accounts"."account_user" from "authenticated";

revoke update on table "accounts"."account_user" from "authenticated";

revoke delete on table "accounts"."account_user" from "service_role";

revoke insert on table "accounts"."account_user" from "service_role";

revoke select on table "accounts"."account_user" from "service_role";

revoke update on table "accounts"."account_user" from "service_role";

revoke delete on table "accounts"."accounts" from "authenticated";

revoke insert on table "accounts"."accounts" from "authenticated";

revoke select on table "accounts"."accounts" from "authenticated";

revoke update on table "accounts"."accounts" from "authenticated";

revoke delete on table "accounts"."accounts" from "service_role";

revoke insert on table "accounts"."accounts" from "service_role";

revoke select on table "accounts"."accounts" from "service_role";

revoke update on table "accounts"."accounts" from "service_role";

revoke select on table "accounts"."billing_customers" from "authenticated";

revoke delete on table "accounts"."billing_customers" from "service_role";

revoke insert on table "accounts"."billing_customers" from "service_role";

revoke select on table "accounts"."billing_customers" from "service_role";

revoke update on table "accounts"."billing_customers" from "service_role";

revoke select on table "accounts"."billing_subscriptions" from "authenticated";

revoke delete on table "accounts"."billing_subscriptions" from "service_role";

revoke insert on table "accounts"."billing_subscriptions" from "service_role";

revoke select on table "accounts"."billing_subscriptions" from "service_role";

revoke update on table "accounts"."billing_subscriptions" from "service_role";

revoke select on table "accounts"."config" from "authenticated";

revoke select on table "accounts"."config" from "service_role";

revoke delete on table "accounts"."invitations" from "authenticated";

revoke insert on table "accounts"."invitations" from "authenticated";

revoke select on table "accounts"."invitations" from "authenticated";

revoke update on table "accounts"."invitations" from "authenticated";

revoke delete on table "accounts"."invitations" from "service_role";

revoke insert on table "accounts"."invitations" from "service_role";

revoke select on table "accounts"."invitations" from "service_role";

revoke update on table "accounts"."invitations" from "service_role";

alter table "accounts"."accounts" alter column "id" set default extensions.uuid_generate_v4();

alter table "accounts"."invitations" alter column "id" set default extensions.uuid_generate_v4();

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION accounts.add_current_user_to_new_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if new.primary_owner_user_id = auth.uid() then
        insert into accounts.account_user (account_id, user_id, account_role)
        values (NEW.id, auth.uid(), 'owner');
    end if;
    return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION accounts.generate_token(length integer)
 RETURNS text
 LANGUAGE sql
AS $function$
select regexp_replace(replace(
                              replace(replace(replace(encode(gen_random_bytes(length)::bytea, 'base64'), '/', ''), '+',
                                              ''), '\\', ''),
                              '=',
                              ''), E'[\\n\\r]+', '', 'g');
$function$
;

CREATE OR REPLACE FUNCTION accounts.get_accounts_with_role(passed_in_role accounts.account_role DEFAULT NULL::accounts.account_role)
 RETURNS SETOF uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select account_id
from accounts.account_user wu
where wu.user_id = auth.uid()
  and (
            wu.account_role = passed_in_role
        or passed_in_role is null
    );
$function$
;

CREATE OR REPLACE FUNCTION accounts.get_config()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    result RECORD;
BEGIN
    SELECT * from accounts.config limit 1 into result;
    return row_to_json(result);
END;
$function$
;

CREATE OR REPLACE FUNCTION accounts.has_role_on_account(account_id uuid, account_role accounts.account_role DEFAULT NULL::accounts.account_role)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
select exists(
               select 1
               from accounts.account_user wu
               where wu.user_id = auth.uid()
                 and wu.account_id = has_role_on_account.account_id
                 and (
                           wu.account_role = has_role_on_account.account_role
                       or has_role_on_account.account_role is null
                   )
           );
$function$
;

CREATE OR REPLACE FUNCTION accounts.is_set(field_name text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    result BOOLEAN;
BEGIN
    execute format('select %I from accounts.config limit 1', field_name) into result;
    return result;
END;
$function$
;

CREATE OR REPLACE FUNCTION accounts.protect_account_fields()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        -- these are protected fields that users are not allowed to update themselves
        -- platform admins should be VERY careful about updating them as well.
        if NEW.id <> OLD.id
            OR NEW.personal_account <> OLD.personal_account
            OR NEW.primary_owner_user_id <> OLD.primary_owner_user_id
        THEN
            RAISE EXCEPTION 'You do not have permission to update this field';
        end if;
    end if;

    RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION accounts.run_new_user_setup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    first_account_id    uuid;
    team_account_id     uuid;
    generated_user_name text;
begin

    -- first we setup the user profile
    insert into public.user_settings (user_id) values (NEW.id);

    -- TODO: see if we can get the user's name from the auth.users table once we learn how oauth works
    if new.email IS NOT NULL then
        generated_user_name := split_part(new.email, '@', 1);
    end if;
    -- create the new users's personal account
    insert into accounts.accounts (name, primary_owner_user_id, personal_account, id)
    values (generated_user_name, NEW.id, true, NEW.id)
    returning id into first_account_id;

    -- add them to the account_user table so they can act on it
    insert into accounts.account_user (account_id, user_id, account_role)
    values (first_account_id, NEW.id, 'owner');

-- create first TEAM account, make user owner
-- call the create_account_id function
select create_account_id(NEW.id, NULL, generated_user_name) into team_account_id;
insert into accounts.account_user (account_id, user_id, account_role)
values (team_account_id, NEW.id, 'owner');

-- select update_account_user_role(team_account_id, team_account_id, true);

    -- Removed automatic project and account_settings creation on signup.
    -- Project onboarding is now handled in-app on first visit to /home.

    return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION accounts.slugify_account_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    if NEW.slug is not null then
        NEW.slug := lower(
      trim(both '-' FROM
        regexp_replace(
          regexp_replace(NEW.slug, '[^A-Za-z0-9-]+', '-', 'g'),
        '-+', '-', 'g')
      )
    );
    end if;

    RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION accounts.trigger_set_invitation_details()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.invited_by_user_id = auth.uid();
    NEW.account_name = (select name from accounts.accounts where id = NEW.account_id);
    RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION accounts.trigger_set_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    if TG_OP = 'INSERT' then
        NEW.created_at = now();
        NEW.updated_at = now();
    else
        NEW.updated_at = now();
        NEW.created_at = OLD.created_at;
    end if;
    RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION accounts.trigger_set_user_tracking()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    has_created_by boolean;
    has_updated_by boolean;
BEGIN
    -- Skip auth.users table entirely
    IF TG_TABLE_SCHEMA = 'auth' AND TG_TABLE_NAME = 'users' THEN
        RETURN NEW;
    END IF;

    -- Check if the table has the required columns
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = TG_TABLE_SCHEMA
        AND table_name = TG_TABLE_NAME
        AND column_name = 'created_by'
    ) INTO has_created_by;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = TG_TABLE_SCHEMA
        AND table_name = TG_TABLE_NAME
        AND column_name = 'updated_by'
    ) INTO has_updated_by;

    -- Only set the fields if they exist
    IF TG_OP = 'INSERT' THEN
        IF has_created_by THEN
            NEW.created_by = auth.uid();
        END IF;
        IF has_updated_by THEN
            NEW.updated_by = auth.uid();
        END IF;
    ELSE
        IF has_updated_by THEN
            NEW.updated_by = auth.uid();
        END IF;
        IF has_created_by THEN
            NEW.created_by = OLD.created_by;
        END IF;
    END IF;
    RETURN NEW;
END
$function$
;


