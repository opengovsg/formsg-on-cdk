import { RemovalPolicy } from 'aws-cdk-lib'
import { BlockPublicAccess, Bucket, BucketAccessControl, HttpMethods, ObjectOwnership } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import envVars from '../formsg-env-vars'

export class FormsgS3Buckets extends Construct {
  readonly s3Attachment: Bucket
  readonly s3PaymentProof: Bucket
  readonly s3Image: Bucket
  readonly s3Logo: Bucket
  readonly s3StaticAssets: Bucket
  readonly s3VirusScannerQuarantine: Bucket
  readonly s3VirusScannerClean: Bucket
  constructor(
    scope: Construct, 
    { origin, s3Suffix }: { origin: string; s3Suffix: string }
  ) {
    super(scope, 's3')

    this.s3Attachment = new Bucket(this, `attachment`, {
      bucketName: `${envVars.ATTACHMENT_S3_BUCKET}-${s3Suffix}`,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3PaymentProof = new Bucket(this, `payment-proof`, {
      bucketName: `${envVars.PAYMENT_PROOF_S3_BUCKET}-${s3Suffix}`,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    const cors = [
      {
        allowedMethods: [HttpMethods.GET, HttpMethods.POST],
        allowedOrigins: [origin],
      }
    ]

    this.s3Image = new Bucket(this, `image`, {
      bucketName: `${envVars.IMAGE_S3_BUCKET}-${s3Suffix}`,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      blockPublicAccess: {
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      },
      publicReadAccess: true,
      cors,
    })
    this.s3Image.grantPublicAccess('*', 's3:GetObject', 's3:PutObject', 's3:PutObjectAcl')

    this.s3Logo = new Bucket(this, `logo`, {
      bucketName: `${envVars.LOGO_S3_BUCKET}-${s3Suffix}`,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      blockPublicAccess: {
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      },
      publicReadAccess: true,
      cors,
    })
    this.s3Logo.grantPublicAccess('*', 's3:GetObject', 's3:PutObject', 's3:PutObjectAcl')

    this.s3StaticAssets = new Bucket(this, `static-assets`, {
      bucketName: `${envVars.STATIC_ASSETS_S3_BUCKET}-${s3Suffix}`,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
      cors,
    })

    this.s3VirusScannerQuarantine = new Bucket(this, `virus-scanner-quarantine`, {
      bucketName: `${envVars.VIRUS_SCANNER_QUARANTINE_S3_BUCKET}-${s3Suffix}`,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3VirusScannerClean = new Bucket(this, `virus-scanner-clean`, {
      bucketName: `${envVars.VIRUS_SCANNER_CLEAN_S3_BUCKET}-${s3Suffix}`,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

  }

}
