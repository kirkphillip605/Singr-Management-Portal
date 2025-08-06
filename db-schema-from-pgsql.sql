create table public.users
(
    id            uuid                     default gen_random_uuid() not null
        primary key,
    name          text,
    email         text                                               not null
        unique,
    emailverified timestamp with time zone,
    image         text,
    businessname  text,
    phonenumber   text,
    passwordhash  text,
    createdat     timestamp with time zone default now()             not null,
    updatedat     timestamp with time zone default now()             not null
);

alter table public.users
    owner to postgres;

create index idx_users_email
    on public.users (email);

create trigger trg_users_updatedat
    before update
    on public.users
    for each row
execute procedure public.set_updated_at();

create table public.accounts
(
    id                 uuid                     default gen_random_uuid() not null
        primary key,
    userid             uuid                                               not null
        references public.users
            on update cascade on delete cascade,
    type               text                                               not null,
    provider           text                                               not null,
    provideraccountid  text                                               not null,
    refresh_token      text,
    access_token       text,
    expires_at         integer,
    token_type         text,
    scope              text,
    id_token           text,
    session_state      text,
    oauth_token_secret text,
    oauth_token        text,
    createdat          timestamp with time zone default now()             not null,
    updatedat          timestamp with time zone default now()             not null,
    unique (provider, provideraccountid)
);

alter table public.accounts
    owner to postgres;

create index idx_accounts_userid
    on public.accounts (userid);

create trigger trg_accounts_updatedat
    before update
    on public.accounts
    for each row
execute procedure public.set_updated_at();

create table public.sessions
(
    id           uuid                     default gen_random_uuid() not null
        primary key,
    sessiontoken text                                               not null
        unique,
    userid       uuid                                               not null
        references public.users
            on update cascade on delete cascade,
    expires      timestamp with time zone                           not null,
    createdat    timestamp with time zone default now()             not null,
    updatedat    timestamp with time zone default now()             not null
);

alter table public.sessions
    owner to postgres;

create index idx_sessions_userid
    on public.sessions (userid);

create trigger trg_sessions_updatedat
    before update
    on public.sessions
    for each row
execute procedure public.set_updated_at();

create table public.verification_tokens
(
    identifier text                                   not null,
    token      text                                   not null
        unique,
    expires    timestamp with time zone               not null,
    createdat  timestamp with time zone default now() not null,
    updatedat  timestamp with time zone default now() not null,
    primary key (identifier, token)
);

alter table public.verification_tokens
    owner to postgres;

create index idx_verification_tokens_expires
    on public.verification_tokens (expires);

create trigger trg_verification_tokens_updatedat
    before update
    on public.verification_tokens
    for each row
execute procedure public.set_updated_at();

create table public.customers
(
    id               uuid                                   not null
        primary key
        references public.users
            on update cascade on delete cascade,
    stripecustomerid text                                   not null
        unique,
    createdat        timestamp with time zone default now() not null,
    updatedat        timestamp with time zone default now() not null
);

alter table public.customers
    owner to postgres;

create index idx_customers_stripecustomerid
    on public.customers (stripecustomerid);

create trigger trg_customers_updatedat
    before update
    on public.customers
    for each row
execute procedure public.set_updated_at();

create table public.payment_methods
(
    id                text                                                  not null
        primary key,
    type              text                                                  not null,
    metadata          jsonb                       default '{}'::jsonb       not null,
    acss_debit        jsonb,
    affirm            jsonb,
    afterpay_clearpay jsonb,
    alipay            jsonb,
    au_becs_debit     jsonb,
    bacs_debit        jsonb,
    bancontact        jsonb,
    billing_details   jsonb                       default '{}'::jsonb       not null,
    blik              jsonb,
    boleto            jsonb,
    card              jsonb,
    card_present      jsonb,
    cashapp           jsonb,
    created           timestamp(6) with time zone                           not null,
    customer          text
        references public.customers (stripecustomerid)
            on update cascade on delete cascade,
    customer_balance  jsonb,
    eps               jsonb,
    fpx               jsonb,
    giropay           jsonb,
    grabpay           jsonb,
    ideal             jsonb,
    interac_present   jsonb,
    klarna            jsonb,
    konbini           jsonb,
    link              jsonb,
    livemode          boolean                     default false             not null,
    object            text,
    oxxo              jsonb,
    p24               jsonb,
    paynow            jsonb,
    paypal            jsonb,
    pix               jsonb,
    promptpay         jsonb,
    radar_options     jsonb,
    revolut_pay       jsonb,
    sepa_debit        jsonb,
    sofort            jsonb,
    swish             jsonb,
    updated           timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
    us_bank_account   jsonb,
    wechat_pay        jsonb,
    zip               jsonb
);

alter table public.payment_methods
    owner to postgres;

create index idx_payment_methods_customer
    on public.payment_methods (customer);

create index idx_payment_methods_type
    on public.payment_methods (type);

create trigger trg_payment_methods_updatedat
    before update
    on public.payment_methods
    for each row
execute procedure public.set_updated_at();

create table public.api_keys
(
    id          uuid                     default gen_random_uuid()      not null
        primary key,
    customerid  uuid                                                    not null
        references public.customers
            on update cascade on delete cascade,
    description text,
    apikeyhash  text                                                    not null,
    createdat   timestamp with time zone default now()                  not null,
    lastusedat  timestamp with time zone,
    status      apikeystatus             default 'active'::apikeystatus not null,
    revokedat   timestamp with time zone,
    updatedat   timestamp with time zone default now()                  not null
);

alter table public.api_keys
    owner to postgres;

create index idx_api_keys_customerid
    on public.api_keys (customerid);

create trigger trg_api_keys_updatedat
    before update
    on public.api_keys
    for each row
execute procedure public.set_updated_at();

create table public.songdb
(
    song_id             bigserial
        primary key,
    user_id             uuid                                   not null
        references public.users
            on update cascade on delete cascade,
    system_id           integer                  default 0     not null,
    artist              varchar(255)                           not null,
    title               varchar(255)                           not null,
    combined            varchar(255)                           not null,
    normalized_combined varchar(255)                           not null,
    createdat           timestamp with time zone default now() not null,
    updatedat           timestamp with time zone default now() not null,
    unique (user_id, system_id, combined),
    unique (user_id, system_id, normalized_combined)
);

alter table public.songdb
    owner to postgres;

create index idx_songdb_user_system_artist
    on public.songdb (user_id, system_id, artist);

create index idx_songdb_user_system_title
    on public.songdb (user_id, system_id, title);

create index idx_songdb_user_system_normcombined
    on public.songdb (user_id, system_id, normalized_combined);

create trigger trg_songdb_updatedat
    before update
    on public.songdb
    for each row
execute procedure public.set_updated_at();

create table public.stripe_webhook_events
(
    id            serial
        primary key,
    event_id      text                                   not null
        unique,
    payload       jsonb                                  not null,
    received_at   timestamp with time zone default now() not null,
    processed     boolean                  default false not null,
    processed_at  timestamp with time zone,
    error_message text,
    api_version   text,
    event_type    text                                   not null,
    livemode      boolean                  default false not null
);

alter table public.stripe_webhook_events
    owner to postgres;

create index idx_stripe_webhook_events_received_at
    on public.stripe_webhook_events (received_at);

create index idx_stripe_webhook_events_type
    on public.stripe_webhook_events (event_type);

create index idx_stripe_webhook_events_processed
    on public.stripe_webhook_events (processed);

create table public.stripe_checkout_sessions
(
    id                                   text                                                  not null
        primary key,
    customerid                           uuid
        references public.customers
            on update cascade on delete cascade,
    payment_status                       text,
    mode                                 text                                                  not null,
    amount_total                         bigint,
    currency                             char(3)
        constraint stripe_checkout_sessions_currency_check
            check (char_length(currency) = 3),
    expires_at                           timestamp with time zone,
    url                                  text,
    metadata                             jsonb                       default '{}'::jsonb       not null,
    after_expiration                     jsonb,
    allow_promotion_codes                boolean,
    amount_subtotal                      bigint,
    automatic_tax                        jsonb                       default '{}'::jsonb       not null,
    billing_address_collection           text,
    cancel_url                           text,
    client_reference_id                  text,
    consent                              jsonb,
    consent_collection                   jsonb,
    created                              timestamp(6) with time zone                           not null,
    currency_conversion                  jsonb,
    custom_fields                        jsonb                       default '[]'::jsonb       not null,
    custom_text                          jsonb                       default '{}'::jsonb       not null,
    customer                             text,
    customer_creation                    text,
    customer_details                     jsonb,
    customer_email                       text,
    invoice                              text,
    invoice_creation                     jsonb,
    livemode                             boolean                     default false             not null,
    locale                               text,
    object                               text,
    payment_intent                       text,
    payment_link                         text,
    payment_method_collection            text,
    payment_method_configuration_details jsonb,
    payment_method_options               jsonb                       default '{}'::jsonb       not null,
    payment_method_types                 jsonb                       default '[]'::jsonb       not null,
    phone_number_collection              jsonb,
    recovered_from                       text,
    setup_intent                         text,
    shipping_address_collection          jsonb,
    shipping_cost                        jsonb,
    shipping_details                     jsonb,
    shipping_options                     jsonb                       default '[]'::jsonb       not null,
    status                               text,
    submit_type                          text,
    subscription                         text,
    success_url                          text,
    total_details                        jsonb,
    ui_mode                              text,
    updated                              timestamp(6) with time zone default CURRENT_TIMESTAMP not null
);

alter table public.stripe_checkout_sessions
    owner to postgres;

create index idx_checkout_sessions_customer
    on public.stripe_checkout_sessions (customer);

create index idx_checkout_sessions_status
    on public.stripe_checkout_sessions (status);

create index idx_checkout_sessions_mode
    on public.stripe_checkout_sessions (mode);

create trigger trg_stripe_checkout_sessions_updatedat
    before update
    on public.stripe_checkout_sessions
    for each row
execute procedure public.set_updated_at();

create table public.stripe_payment_intents
(
    id                                   text                                                  not null
        primary key,
    session_id                           text
                                                                                               references public.stripe_checkout_sessions
                                                                                                   on update cascade on delete set null,
    customerid                           uuid
        references public.customers
            on update cascade on delete cascade,
    amount                               bigint                                                not null,
    currency                             char(3)                                               not null
        constraint stripe_payment_intents_currency_check
            check (char_length(currency) = 3),
    status                               text                                                  not null,
    capture_method                       text                                                  not null,
    metadata                             jsonb                       default '{}'::jsonb       not null,
    amount_capturable                    bigint                      default 0                 not null,
    amount_details                       jsonb,
    amount_received                      bigint                      default 0                 not null,
    application                          text,
    application_fee_amount               bigint,
    automatic_payment_methods            jsonb,
    canceled_at                          timestamp(6) with time zone,
    cancellation_reason                  text,
    charges                              jsonb                       default '{}'::jsonb       not null,
    client_secret                        text,
    confirmation_method                  text                                                  not null,
    created                              timestamp(6) with time zone                           not null,
    customer                             text,
    description                          text,
    invoice                              text,
    last_payment_error                   jsonb,
    latest_charge                        text,
    livemode                             boolean                     default false             not null,
    next_action                          jsonb,
    object                               text,
    on_behalf_of                         text,
    payment_method                       text,
    payment_method_configuration_details jsonb,
    payment_method_options               jsonb                       default '{}'::jsonb       not null,
    payment_method_types                 jsonb                       default '[]'::jsonb       not null,
    processing                           jsonb,
    receipt_email                        text,
    review                               text,
    setup_future_usage                   text,
    shipping                             jsonb,
    statement_descriptor                 text,
    statement_descriptor_suffix          text,
    transfer_data                        jsonb,
    transfer_group                       text,
    updated                              timestamp(6) with time zone default CURRENT_TIMESTAMP not null
);

alter table public.stripe_payment_intents
    owner to postgres;

create index idx_payment_intents_customer
    on public.stripe_payment_intents (customer);

create index idx_payment_intents_status
    on public.stripe_payment_intents (status);

create index idx_payment_intents_session
    on public.stripe_payment_intents (session_id);

create trigger trg_stripe_payment_intents_updatedat
    before update
    on public.stripe_payment_intents
    for each row
execute procedure public.set_updated_at();

create table public.spatial_ref_sys
(
    srid      integer not null
        primary key
        constraint spatial_ref_sys_srid_check
            check ((srid > 0) AND (srid <= 998999)),
    auth_name varchar(256),
    auth_srid integer,
    srtext    varchar(2048),
    proj4text varchar(2048)
);

alter table public.spatial_ref_sys
    owner to postgres;

grant select on public.spatial_ref_sys to public;

create table public.venues
(
    id                uuid                        default gen_random_uuid() not null
        primary key,
    userid            uuid                                                  not null
        references public.users
            on update cascade on delete cascade,
    urlname           text                                                  not null,
    acceptingrequests boolean                     default true              not null,
    hereplaceid       text,
    name              text                                                  not null,
    address           text,
    city              text,
    state             text,
    statecode         varchar(5),
    postalcode        text,
    country           text,
    countrycode       varchar(3),
    phonenumber       varchar(20),
    website           text,
    latitude          double precision,
    longitude         double precision,
    createdat         timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
    updatedat         timestamp(6) with time zone default CURRENT_TIMESTAMP not null
);

alter table public.venues
    owner to postgres;

create unique index idx_venues_hereplaceid
    on public.venues (hereplaceid);

create index idx_venues_userid
    on public.venues (userid);

create index idx_venues_user_urlname
    on public.venues (userid, urlname);

create index idx_venues_address
    on public.venues (address);

create index idx_venues_name
    on public.venues (name);

create index idx_venues_city
    on public.venues (city);

create index idx_venues_location_brin
    on public.venues using brin (latitude, longitude);

create index idx_venues_region
    on public.venues (countrycode, statecode, city);

create unique index venues_userid_name_address_key
    on public.venues (userid, name, address);

create unique index venues_userid_urlname_key
    on public.venues (userid, urlname);

create table public.state
(
    venueid   uuid                                                  not null
        references public.venues
            on update cascade on delete cascade,
    system_id integer                     default 0                 not null,
    accepting boolean                     default false             not null,
    serial    integer                     default 1                 not null,
    createdat timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
    updatedat timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
    primary key (venueid, system_id)
);

alter table public.state
    owner to postgres;

create table public.requests
(
    request_id   bigserial
        primary key,
    venueid      uuid                                                  not null
        references public.venues
            on update cascade on delete cascade,
    system_id    integer                     default 0                 not null,
    artist       text                                                  not null,
    title        text                                                  not null,
    singer       text,
    request_time timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
    key_change   integer                     default 0                 not null,
    createdat    timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
    updatedat    timestamp(6) with time zone default CURRENT_TIMESTAMP not null
);

alter table public.requests
    owner to postgres;

create index idx_requests_vr_sys_time
    on public.requests (venueid, system_id, request_time);

create table public.products
(
    id                   text                                                  not null
        primary key,
    object               text,
    active               boolean                     default true              not null,
    name                 text,
    description          text,
    images               text[]                      default ARRAY []::text[],
    metadata             jsonb                       default '{}'::jsonb       not null,
    package_dimensions   jsonb,
    shippable            boolean,
    statement_descriptor text,
    tax_code             text,
    unit_label           text,
    url                  text,
    created              timestamp(6) with time zone                           not null,
    updated              timestamp(6) with time zone default CURRENT_TIMESTAMP not null
);

alter table public.products
    owner to postgres;

create index products_active_idx
    on public.products (active);

create table public.prices
(
    id                  text                                                  not null
        primary key,
    object              text,
    active              boolean                     default true              not null,
    billing_scheme      text,
    currency            char(3)                                               not null,
    custom_unit_amount  jsonb,
    livemode            boolean                     default false             not null,
    lookup_key          text,
    metadata            jsonb                       default '{}'::jsonb       not null,
    nickname            text,
    product             text                                                  not null
        references public.products
            on update cascade on delete cascade,
    recurring           jsonb,
    tax_behavior        text,
    tiers_mode          text,
    transform_quantity  jsonb,
    type                text                                                  not null,
    unit_amount         bigint,
    unit_amount_decimal text,
    created             timestamp(6) with time zone                           not null,
    updated             timestamp(6) with time zone default CURRENT_TIMESTAMP not null
);

alter table public.prices
    owner to postgres;

create table public.subscriptions
(
    id                                text                                                  not null
        primary key,
    userid                            uuid                                                  not null
        references public.users
            on update cascade on delete cascade,
    metadata                          jsonb                       default '{}'::jsonb       not null,
    application_fee_percent           double precision,
    automatic_tax                     jsonb                       default '{}'::jsonb       not null,
    billing_cycle_anchor              timestamp(6) with time zone,
    billing_thresholds                jsonb,
    cancel_at                         timestamp(6) with time zone,
    cancel_at_period_end              boolean                     default false             not null,
    canceled_at                       timestamp(6) with time zone,
    collection_method                 text,
    created                           timestamp(6) with time zone                           not null,
    currency                          char(3)                                               not null,
    current_period_end                timestamp(6) with time zone                           not null,
    current_period_start              timestamp(6) with time zone                           not null,
    customer                          text                                                  not null
        references public.customers (stripecustomerid)
            on update cascade on delete cascade,
    days_until_due                    integer,
    default_payment_method            text,
    default_source                    text,
    default_tax_rates                 jsonb                       default '[]'::jsonb       not null,
    description                       text,
    discount                          jsonb,
    ended_at                          timestamp(6) with time zone,
    items                             jsonb                       default '{}'::jsonb       not null,
    latest_invoice                    text,
    livemode                          boolean                     default false             not null,
    next_pending_invoice_item_invoice timestamp(6) with time zone,
    object                            text,
    pause_collection                  jsonb,
    payment_settings                  jsonb                       default '{}'::jsonb       not null,
    pending_invoice_item_interval     jsonb,
    pending_setup_intent              text,
    pending_update                    jsonb,
    "priceId"                         text
                                                                                            references public.prices
                                                                                                on update cascade on delete set null,
    schedule                          text,
    start_date                        timestamp(6) with time zone                           not null,
    test_clock                        text,
    transfer_data                     jsonb,
    trial_end                         timestamp(6) with time zone,
    trial_start                       timestamp(6) with time zone,
    updated                           timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
    status                            text                                                  not null
);

alter table public.subscriptions
    owner to postgres;

create index idx_subscriptions_userid
    on public.subscriptions (userid);

create index idx_subscriptions_customer
    on public.subscriptions (customer);

create index idx_subscriptions_status
    on public.subscriptions (status);

create trigger trg_subscriptions_updatedat
    before update
    on public.subscriptions
    for each row
execute procedure public.set_updated_at();

create table public.invoices
(
    id                               text                                                  not null
        primary key,
    customerid                       uuid                                                  not null
        references public.customers
            on update cascade on delete cascade,
    status                           text                                                  not null,
    currency                         char(3)                                               not null
        constraint invoices_currency_check
            check (char_length(currency) = 3),
    metadata                         jsonb                       default '{}'::jsonb       not null,
    account_country                  text,
    account_name                     text,
    account_tax_ids                  jsonb,
    amount_due                       bigint                                                not null,
    amount_paid                      bigint                                                not null,
    amount_remaining                 bigint                                                not null,
    amount_shipping                  bigint                      default 0                 not null,
    application                      text,
    application_fee_amount           bigint,
    attempt_count                    integer                     default 0                 not null,
    attempted                        boolean                     default false             not null,
    auto_advance                     boolean                     default true              not null,
    automatic_tax                    jsonb                       default '{}'::jsonb       not null,
    billing_reason                   text,
    charge                           text,
    collection_method                text                                                  not null,
    created                          timestamp(6) with time zone                           not null,
    custom_fields                    jsonb,
    customer                         text                                                  not null,
    customer_address                 jsonb,
    customer_email                   text,
    customer_name                    text,
    customer_phone                   text,
    customer_shipping                jsonb,
    customer_tax_exempt              text,
    customer_tax_ids                 jsonb,
    default_payment_method           text,
    default_source                   text,
    default_tax_rates                jsonb                       default '[]'::jsonb       not null,
    description                      text,
    discount                         jsonb,
    discounts                        jsonb                       default '[]'::jsonb       not null,
    due_date                         timestamp(6) with time zone,
    effective_at                     timestamp(6) with time zone,
    ending_balance                   bigint,
    footer                           text,
    from_invoice                     jsonb,
    hosted_invoice_url               text,
    invoice_pdf                      text,
    last_finalization_error          jsonb,
    latest_revision                  text,
    lines                            jsonb                       default '{}'::jsonb       not null,
    livemode                         boolean                     default false             not null,
    next_payment_attempt             timestamp(6) with time zone,
    number                           text,
    object                           text,
    on_behalf_of                     text,
    paid                             boolean                     default false             not null,
    paid_out_of_band                 boolean                     default false             not null,
    payment_intent                   text,
    payment_settings                 jsonb                       default '{}'::jsonb       not null,
    period_end                       timestamp(6) with time zone                           not null,
    period_start                     timestamp(6) with time zone                           not null,
    post_payment_credit_notes_amount bigint                      default 0                 not null,
    pre_payment_credit_notes_amount  bigint                      default 0                 not null,
    quote                            text,
    receipt_number                   text,
    rendering_options                jsonb,
    shipping_cost                    jsonb,
    shipping_details                 jsonb,
    starting_balance                 bigint                      default 0                 not null,
    statement_descriptor             text,
    status_transitions               jsonb                       default '{}'::jsonb       not null,
    subscription                     text
                                                                                           references public.subscriptions
                                                                                               on update cascade on delete set null,
    subscription_details             jsonb,
    subtotal                         bigint                                                not null,
    subtotal_excluding_tax           bigint,
    tax                              bigint,
    test_clock                       text,
    total                            bigint                                                not null,
    total_discount_amounts           jsonb                       default '[]'::jsonb       not null,
    total_excluding_tax              bigint,
    total_tax_amounts                jsonb                       default '[]'::jsonb       not null,
    transfer_data                    jsonb,
    updated                          timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
    webhooks_delivered_at            timestamp(6) with time zone
);

alter table public.invoices
    owner to postgres;

create index idx_invoices_customerid
    on public.invoices (customerid);

create index idx_invoices_customer
    on public.invoices (customer);

create index idx_invoices_subscription
    on public.invoices (subscription);

create index idx_invoices_status
    on public.invoices (status);

create trigger trg_invoices_updatedat
    before update
    on public.invoices
    for each row
execute procedure public.set_updated_at();

create index idx_prices_product
    on public.prices (product);

create index prices_active_idx
    on public.prices (active);

create index prices_type_idx
    on public.prices (type);

create table public.coupons
(
    id                 text                                                  not null
        primary key,
    object             text,
    amount_off         bigint,
    applies_to         jsonb,
    currency           char(3),
    duration           text                                                  not null,
    duration_in_months integer,
    livemode           boolean                     default false             not null,
    max_redemptions    integer,
    metadata           jsonb                       default '{}'::jsonb       not null,
    name               text,
    percent_off        double precision,
    redeem_by          timestamp(6) with time zone,
    times_redeemed     integer                     default 0                 not null,
    valid              boolean                     default true              not null,
    created            timestamp(6) with time zone                           not null,
    updated            timestamp(6) with time zone default CURRENT_TIMESTAMP not null
);

alter table public.coupons
    owner to postgres;

create table public.promotion_codes
(
    id                     text                                                  not null
        primary key,
    code                   text                                                  not null
        unique,
    active                 boolean                     default true              not null,
    metadata               jsonb                       default '{}'::jsonb       not null,
    coupon                 text                                                  not null
        references public.coupons
            on update cascade on delete cascade,
    created                timestamp(6) with time zone                           not null,
    customer               text,
    expires_at             timestamp(6) with time zone,
    first_time_transaction boolean                     default false             not null,
    livemode               boolean                     default false             not null,
    max_redemptions        integer,
    object                 text,
    restrictions           jsonb                       default '{}'::jsonb       not null,
    times_redeemed         integer                     default 0                 not null,
    updated                timestamp(6) with time zone default CURRENT_TIMESTAMP not null
);

alter table public.promotion_codes
    owner to postgres;

create index idx_promotion_codes_coupon
    on public.promotion_codes (coupon);

create index promotion_codes_active_idx
    on public.promotion_codes (active);

create index promotion_codes_code_idx
    on public.promotion_codes (code);

create trigger trg_promotion_codes_updatedat
    before update
    on public.promotion_codes
    for each row
execute procedure public.set_updated_at();

create index coupons_valid_idx
    on public.coupons (valid);

create index coupons_duration_idx
    on public.coupons (duration);

